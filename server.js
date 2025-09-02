const express = require('express');
const path = require('path');
const app = express();
const redis = require('redis');
const bodyParser = require('body-parser');
let cli = null

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/pedido', async (req, res) => {
  const obj = JSON.parse(JSON.stringify(req.body));
  try{
    for (const item of obj.itens) {
      const ip = req.ip;
      const nome = item.nome;
      const qty = item.quantidade;
      const preco = item.preco;
      const existente = await cli.hExists(ip, nome);

      if (existente == 1) {
        console.log("dentro do if, produto ja existia");
        await cli.hIncrBy(ip, "quantidade:" + nome, qty);
      }else{
        console.log("dentro do else, produto nao existia");
        await cli.hSet(ip, {
          [nome]: nome,
          ['quantidade:' + nome]: qty,
          ['preco:' + nome]: preco
        });
        await cli.expire(ip, 172800);
      }
    }

    res.json({ status: 'Produto(s) adicionado(s)!' });

  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar ao carrinho de compras :(' });
  }
});

app.get("/carrinho", async (req, res) => {
  const key = req.ip;
  const dados = await cli.hGetAll(key);
  console.log("carrinho: ",dados);
  const itens = [];

  // percorre todas as chaves retornadas do Redis
  Object.entries(dados).forEach(([campo, valor]) => {
    if (campo.includes("quantidade:")) {
      const nome = campo.split(":")[1];
      const quantidade = parseInt(valor);
      const preco = parseFloat(dados[`preco:${nome}`]);
      itens.push({
        nome,
        quantidade,
        preco
      });
    }
  });

  console.log("itens formatados:", itens);
  res.json(itens);
});

app.post("/carrinho/atualizar", async (req, res) => {
  const key = req.ip;
  const { nome, quantidade } = req.body;

  if (quantidade > 0) {
    await cli.hSet(key, `quantidade:${nome}`, quantidade.toString());
  } else {
    await cli.hDel(key, nome);
    await cli.hDel(key, `quantidade:${nome}`);
    await cli.hDel(key, `preco:${nome}`);
  }

  res.json({ ok: true });
});



app.listen(3000, async () => {
    
    cli = redis.createClient({
        socket: {
            host: '<IP_SERVIDOR>',
            port: 6379
        }
    });
    
    cli.on("error", function (error) {
        console.error(error);
    });
    
    await cli.connect();
    
    console.log('conectado', cli.isOpen);
    var ret = await cli.ping();
    console.log(ret)
    
    console.log('Servidor rodando...');

});