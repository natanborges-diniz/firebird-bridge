#!/usr/bin/env node

/**
 * Script de exemplo para testar o endpoint de metadata de receitas
 * 
 * Uso:
 *   node docs/examples/test-metadata-endpoint.js
 *   
 * Requer Node.js 18.x ou 20.x (conforme package.json):
 *   nvm use
 *   node docs/examples/test-metadata-endpoint.js
 */

const http = require('http');

// Configuração do servidor
const API_HOST = process.env.API_HOST || 'localhost';
const API_PORT = process.env.API_PORT || 3000;

/**
 * Faz uma requisição GET para o endpoint
 */
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (err) {
          reject(new Error(`Failed to parse JSON response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

/**
 * Testa o endpoint de metadata
 */
async function testMetadataEndpoint() {
  console.log('='.repeat(80));
  console.log('Testando Endpoint de Metadata de Receitas (OS)');
  console.log('='.repeat(80));
  console.log(`API: http://${API_HOST}:${API_PORT}`);
  console.log('');

  // Teste 1: Verificar se TRANSACAO_ITEM tem COD_ORDEMSERVICOCAIXA
  console.log('📋 Teste 1: Verificando se TRANSACAO_ITEM possui COD_ORDEMSERVICOCAIXA');
  console.log('-'.repeat(80));
  try {
    const campos = 'COD_ORDEMSERVICOCAIXA,COD_TRANSACAO,COD_ITEM,NUMEROORDEMSERVICO';
    const path = `/api/v1/os/receitas-metadata?campos=${campos}&expand=1`;
    console.log(`GET ${path}`);
    console.log('');

    const response = await makeRequest(path);
    
    if (response.status === 200 && response.body.ok) {
      console.log('✅ Sucesso!');
      console.log('');
      
      const transacaoItem = response.body.data.find(t => t.tabela === 'TRANSACAO_ITEM');
      
      if (transacaoItem) {
        console.log('📊 Tabela TRANSACAO_ITEM encontrada:');
        console.log(`   - Campos solicitados encontrados: ${transacaoItem.campos_encontrados.join(', ')}`);
        console.log(`   - Chaves de OS: ${transacaoItem.chaves_os.join(', ')}`);
        console.log(`   - Possui chave OS: ${transacaoItem.possui_chave_os ? 'SIM' : 'NÃO'}`);
        
        if (transacaoItem.campos_encontrados.includes('COD_ORDEMSERVICOCAIXA')) {
          console.log('');
          console.log('✅ COD_ORDEMSERVICOCAIXA EXISTE em TRANSACAO_ITEM');
          console.log('   → A query atual do hub_receitas.sql deve funcionar corretamente');
        } else {
          console.log('');
          console.log('❌ COD_ORDEMSERVICOCAIXA NÃO EXISTE em TRANSACAO_ITEM');
          console.log('   → Precisa usar caminho alternativo na query');
          
          if (transacaoItem.campos_encontrados.includes('NUMEROORDEMSERVICO')) {
            console.log('   → Sugestão: Usar NUMEROORDEMSERVICO para join');
          } else if (transacaoItem.campos_encontrados.includes('COD_TRANSACAO')) {
            console.log('   → Sugestão: Manter join por COD_TRANSACAO com filtros adicionais');
          }
        }
        
        if (transacaoItem.campos_tabela && transacaoItem.campos_tabela.length > 0) {
          console.log('');
          console.log(`📝 Total de colunas na tabela: ${transacaoItem.campos_tabela.length}`);
          console.log(`   Primeiras 10: ${transacaoItem.campos_tabela.slice(0, 10).join(', ')}`);
        }
      } else {
        console.log('⚠️  Tabela TRANSACAO_ITEM não encontrada na resposta');
      }
      
      console.log('');
      console.log(`📊 Total de tabelas encontradas: ${response.body.data.length}`);
      console.log('   Tabelas:', response.body.data.map(t => t.tabela).join(', '));
      
    } else {
      console.log('❌ Erro na requisição');
      console.log('Status:', response.status);
      console.log('Resposta:', JSON.stringify(response.body, null, 2));
    }
  } catch (err) {
    console.log('❌ Erro ao fazer requisição:', err.message);
    console.log('');
    console.log('⚠️  Certifique-se de que o servidor está rodando:');
    console.log('   npm start');
  }

  console.log('');
  console.log('='.repeat(80));
  
  // Teste 2: Descobrir campos de vínculo
  console.log('📋 Teste 2: Descobrindo campos de vínculo com OS');
  console.log('-'.repeat(80));
  try {
    const campos = 'NUMEROORDEMSERVICO,COD_OS,COD_TRANSACAO';
    const path = `/api/v1/os/receitas-metadata?campos=${campos}`;
    console.log(`GET ${path}`);
    console.log('');

    const response = await makeRequest(path);
    
    if (response.status === 200 && response.body.ok) {
      console.log('✅ Sucesso!');
      console.log('');
      
      response.body.data.forEach(table => {
        console.log(`📊 ${table.tabela}:`);
        console.log(`   - Campos encontrados: ${table.campos_encontrados.join(', ')}`);
        console.log(`   - Possui chave OS: ${table.possui_chave_os ? 'SIM' : 'NÃO'}`);
        if (table.possui_chave_os) {
          console.log(`   - Chaves OS: ${table.chaves_os.join(', ')}`);
        }
        console.log('');
      });
      
    } else {
      console.log('❌ Erro na requisição');
      console.log('Status:', response.status);
      console.log('Resposta:', JSON.stringify(response.body, null, 2));
    }
  } catch (err) {
    console.log('❌ Erro ao fazer requisição:', err.message);
  }

  console.log('='.repeat(80));
  console.log('');
  console.log('💡 Dicas:');
  console.log('   - Use expand=1 para ver todas as colunas das tabelas');
  console.log('   - Campos devem estar em UPPERCASE');
  console.log('   - Separe múltiplos campos com vírgula');
  console.log('');
  console.log('📚 Documentação completa: docs/OS_METADATA_ENDPOINT.md');
  console.log('');
}

// Executar testes
testMetadataEndpoint().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
