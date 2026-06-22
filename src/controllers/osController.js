const osService = require('../services/osService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');

function normalizeTextField(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'function') return '';
  return String(value).trim();
}


function validatePeriodoQuery(req, res) {
  const { dataInicio, dataFim, codEmpresa, empresa } = req.query;

  const missing = [];
  if (!dataInicio) missing.push("dataInicio");
  if (!dataFim) missing.push("dataFim");

  if (missing.length > 0) {
    failure(res, {
      code: "INVALID_PARAMS",
      message: "Parâmetros obrigatórios ausentes",
      details: { missing },
      status: 400,
    });
    return null;
  }

  const rawEmpresa = codEmpresa ?? empresa;

  if (
    rawEmpresa === undefined ||
    rawEmpresa === null ||
    rawEmpresa === "" ||
    String(rawEmpresa).toUpperCase() === "ALL"
  ) {
    return { dataInicio, dataFim, codEmpresa: null };
  }

  const num = Number(rawEmpresa);
  if (!Number.isFinite(num)) {
    failure(res, {
      code: "INVALID_PARAMS",
      message: "codEmpresa deve ser numérico ou ALL",
      details: { codEmpresa: rawEmpresa },
      status: 400,
    });
    return null;
  }

  const COD_EMPRESA_LOGICA_PARA_ORIGEM = {
    595: 1,
    599: 9,
  };

  return {
    dataInicio,
    dataFim,
    codEmpresa: COD_EMPRESA_LOGICA_PARA_ORIGEM[num] ?? num,
  };
}

function normalizeCodEmpresa(req, res) {
  const rawEmpresa = req.query.codEmpresa ?? req.query.empresa;
  if (
    rawEmpresa === undefined ||
    rawEmpresa === null ||
    rawEmpresa === "" ||
    String(rawEmpresa).toUpperCase() === "ALL"
  ) {
    return null;
  }

  const num = Number(rawEmpresa);
  if (!Number.isFinite(num)) {
    failure(res, {
      code: "INVALID_PARAMS",
      message: "codEmpresa deve ser numérico ou ALL",
      details: { codEmpresa: rawEmpresa },
      status: 400,
    });
    return null;
  }

  const COD_EMPRESA_LOGICA_PARA_ORIGEM = {
    595: 1,
    599: 9,
  };

  return COD_EMPRESA_LOGICA_PARA_ORIGEM[num] ?? num;
}

async function monitorOs(req, res) {
  try {
    const params = validatePeriodoQuery(req, res);
    if (!params) return;

    const rows = await osService.getMonitorOs(params);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function monitorOsUltimaEtapa(req, res) {
  try {
    const params = validatePeriodoQuery(req, res);
    if (!params) return;

    const rows = await osService.getMonitorOsUltimaEtapa(params);
    const normalizedRows = rows.map((row) => ({
      ...row,
      cpf: String(row.cpf ?? row.CPF ?? '').trim(),
      data_nascimento: row.data_nascimento ?? row.DATA_NASCIMENTO ?? null,
      paciente: String(row.paciente ?? row.PACIENTE ?? '').trim(),
    }));
    return success(res, normalizedRows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function hubReceitas(req, res) {
  try {
    const params = validatePeriodoQuery(req, res);
    if (!params) return;

    const rawOs = req.query.os ?? req.query.numeroOs ?? req.query.numeroOS;
    if (rawOs !== undefined && rawOs !== null && String(rawOs).trim() !== "") {
      const osNumber = Number(rawOs);
      if (!Number.isFinite(osNumber)) {
        return failure(res, {
          code: "INVALID_PARAMS",
          message: "os deve ser numérico",
          details: { os: rawOs },
          status: 400,
        });
      }
      params.os = osNumber;
    }

    const rows = await osService.getHubReceitas(params);
    const normalizedRows = rows.map((row) => ({
      ...row,
      observacao_os: normalizeTextField(row.observacao_os ?? row.OBSERVACAO_OS),
      observacao_receita: normalizeTextField(row.observacao_receita ?? row.OBSERVACAO_RECEITA),
      observacao_receita_os: normalizeTextField(
        row.observacao_receita_os ?? row.OBSERVACAO_RECEITA_OS
      ),
      observacao_receita_cadastro: normalizeTextField(
        row.observacao_receita_cadastro ?? row.OBSERVACAO_RECEITA_CADASTRO
      ),
      medico: normalizeTextField(row.medico ?? row.MEDICO),
      crm: normalizeTextField(row.crm ?? row.CRM),
    }));
    return success(res, normalizedRows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function hubReceitasCompleto(req, res) {
  try {
    const rawOs = req.query.os ?? req.query.numeroOs ?? req.query.numeroOS;
    if (rawOs === undefined || rawOs === null || String(rawOs).trim() === "") {
      return failure(res, {
        code: "INVALID_PARAMS",
        message: "Informe o número da OS em ?os=",
        details: { os: rawOs },
        status: 400,
      });
    }

    const osNumber = Number(rawOs);
    if (!Number.isFinite(osNumber)) {
      return failure(res, {
        code: "INVALID_PARAMS",
        message: "os deve ser numérico",
        details: { os: rawOs },
        status: 400,
      });
    }

    const codEmpresa = normalizeCodEmpresa(req, res);
    if (codEmpresa === null && req.query.codEmpresa) {
      return;
    }

    const payload = await osService.getHubReceitasCompleto({
      os: osNumber,
      codEmpresa,
    });
    return success(res, payload);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

function maskCpf(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return `***${digits.slice(-6)}`;
}

async function consultaStatus(req, res) {
  try {
    const rawOs = req.query.os;
    const rawCpf = req.query.cpf;

    const hasOs = rawOs !== undefined && rawOs !== null && String(rawOs).trim() !== '';
    const hasCpf = rawCpf !== undefined && rawCpf !== null && String(rawCpf).trim() !== '';

    if (!hasOs && !hasCpf) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Informe cpf ou os',
        },
      });
    }

    let os = null;
    let cpf = null;

    if (hasOs) {
      os = Number(rawOs);
      if (!Number.isFinite(os)) {
        return failure(res, {
          code: 'INVALID_PARAMS',
          message: 'os deve ser numérico',
          details: { os: rawOs },
          status: 400,
        });
      }
    }

    if (hasCpf) {
      cpf = String(rawCpf).replace(/\D/g, '');
      if (cpf.length !== 11) {
        return failure(res, {
          code: 'INVALID_PARAMS',
          message: 'cpf deve conter 11 dígitos',
          details: { cpf: rawCpf },
          status: 400,
        });
      }
    }

    console.log('[OS][consulta-status]', {
      os: os ?? null,
      cpf: cpf ? maskCpf(cpf) : null,
    });

    const data = await osService.getConsultaStatus({ os, cpf });
    return res.status(200).json({
      ok: true,
      data,
      meta: {
        count: data.length,
      },
    });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function receitaMetadata(req, res) {
  try {
    const rawCampos = req.query.campos ?? "";
    const includeAllFields =
      String(req.query.expand ?? "")
        .trim()
        .toLowerCase() === "true" ||
      String(req.query.expand ?? "").trim() === "1";
    const campos = String(rawCampos)
      .split(",")
      .map((campo) => campo.trim())
      .filter(Boolean);

    if (campos.length === 0) {
      return failure(res, {
        code: "INVALID_PARAMS",
        message: "Informe ao menos um campo em ?campos=CAMPO1,CAMPO2",
        details: { campos: rawCampos },
        status: 400,
      });
    }

    const chavesOs = [
      "COD_ORDEMSERVICOCAIXA",
      "NUMEROORDEMSERVICO",
      "COD_TRANSACAO",
      "COD_CLIENTE",
      "COD_PESSOA",
    ];

    const { matches, fieldsByTable } = await osService.getReceitaMetadata({
      campos,
      chavesOs,
      includeAllFields,
    });

    const camposUpper = campos.map((campo) => campo.toUpperCase());
    const chavesOsUpper = chavesOs.map((campo) => campo.toUpperCase());
    const tabelaMap = new Map();

    matches.forEach((row) => {
      const tabela = row.tabela;
      const campo = row.campo;
      if (!tabelaMap.has(tabela)) {
        tabelaMap.set(tabela, {
          tabela,
          campos_encontrados: [],
          chaves_os: [],
        });
      }

      const entry = tabelaMap.get(tabela);
      if (camposUpper.includes(campo)) {
        entry.campos_encontrados.push(campo);
      }
      if (chavesOsUpper.includes(campo)) {
        entry.chaves_os.push(campo);
      }
    });

    const payload = Array.from(tabelaMap.values()).map((entry) => {
      const camposTabela = fieldsByTable?.[entry.tabela] ?? null;
      return {
        ...entry,
        possui_chave_os: entry.chaves_os.length > 0,
        campos_tabela: camposTabela,
      };
    });

    return success(res, payload);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function osMovimentadas(req, res) {
  try {
    const { data, codEtapa, codEmpresa, empresa } = req.query;

    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return failure(res, {
        code: 'INVALID_PARAMS',
        message: 'Parâmetro obrigatório ausente ou inválido: data (YYYY-MM-DD)',
        status: 400,
      });
    }

    const rawEmpresa = codEmpresa ?? empresa;
    let codEmpresaNum = null;
    if (rawEmpresa && String(rawEmpresa).toUpperCase() !== 'ALL') {
      codEmpresaNum = Number(rawEmpresa);
      if (!Number.isFinite(codEmpresaNum)) {
        return failure(res, {
          code: 'INVALID_PARAMS',
          message: 'codEmpresa deve ser numérico ou ALL',
          details: { codEmpresa: rawEmpresa },
          status: 400,
        });
      }
    }

    const rows = await osService.getOsMovimentadas({ data, codEtapa, codEmpresa: codEmpresaNum });
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  monitorOs,
  monitorOsUltimaEtapa,
  hubReceitas,
  hubReceitasCompleto,
  consultaStatus,
  receitaMetadata,
  osMovimentadas,
};
