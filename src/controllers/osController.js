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

  const rawEmpresa = (codEmpresa ?? empresa);

  // ✅ ALL / vazio -> todas as empresas
  if (
    rawEmpresa === undefined ||
    rawEmpresa === null ||
    rawEmpresa === "" ||
    String(rawEmpresa).toUpperCase() === "ALL"
  ) {
    return { dataInicio, dataFim, codEmpresa: null };
  }

  // ✅ numérico obrigatório daqui pra frente
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

  // ✅ mapa: código lógico (595) -> código real (cod_empresaorigem)
  const COD_EMPRESA_LOGICA_PARA_ORIGEM = {
    595: 1, // PRIMITIVA I
    // 597: <cod_empresaorigem real>,
    // 599: <cod_empresaorigem real>,
    // ...
  };

  const codEmpresaFinal = COD_EMPRESA_LOGICA_PARA_ORIGEM[num] ?? num;

  return { dataInicio, dataFim, codEmpresa: codEmpresaFinal };
}
