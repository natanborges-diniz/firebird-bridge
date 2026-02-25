const osService = require('../services/osService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');

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
      observacao_os: String(row.observacao_os ?? row.OBSERVACAO_OS ?? "").trim(),
      observacao_receita: String(row.observacao_receita ?? row.OBSERVACAO_RECEITA ?? "").trim(),
      observacao_receita_os: String(
        row.observacao_receita_os ?? row.OBSERVACAO_RECEITA_OS ?? ""
      ).trim(),
      observacao_receita_cadastro: String(
        row.observacao_receita_cadastro ?? row.OBSERVACAO_RECEITA_CADASTRO ?? ""
      ).trim(),
      medico: String(row.medico ?? row.MEDICO ?? "").trim(),
      crm: String(row.crm ?? row.CRM ?? "").trim(),
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

module.exports = {
  monitorOs,
  monitorOsUltimaEtapa,
  hubReceitas,
  hubReceitasCompleto,
  receitaMetadata,
};
