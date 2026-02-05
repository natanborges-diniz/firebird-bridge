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
  };

  return {
    dataInicio,
    dataFim,
    codEmpresa: COD_EMPRESA_LOGICA_PARA_ORIGEM[num] ?? num,
  };
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
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function receitaMetadata(req, res) {
  try {
    const rawCampos = req.query.campos ?? "";
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

    const rows = await osService.getReceitaMetadata({ campos, chavesOs });

    const camposUpper = campos.map((campo) => campo.toUpperCase());
    const chavesOsUpper = chavesOs.map((campo) => campo.toUpperCase());
    const tabelaMap = new Map();

    rows.forEach((row) => {
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

    const payload = Array.from(tabelaMap.values()).map((entry) => ({
      ...entry,
      possui_chave_os: entry.chaves_os.length > 0,
    }));

    return success(res, payload);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  monitorOs,
  monitorOsUltimaEtapa,
  receitaMetadata,
};
