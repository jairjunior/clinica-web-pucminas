const express            = require('express');
const bodyParser         = require('body-parser');
const methodOverride     = require('method-override');
const bcrypt             = require('bcrypt');
const moment             = require('moment');
const MongoClient        = require('mongodb').MongoClient;
const ObjectID           = require('mongodb').ObjectID;
const jwt                = require('jsonwebtoken');
const cookieParser       = require('cookie-parser');
const app = express();
const uri = "mongodb://AdminDB:vW8j7yWkL5ts6ir@database-shard-00-00-h8kqw.mongodb.net:27017,database-shard-00-01-h8kqw.mongodb.net:27017,database-shard-00-02-h8kqw.mongodb.net:27017/test?ssl=true&replicaSet=DataBase-shard-0&authSource=admin&retryWrites=true";
const SALT_ROUNDS = 10;
const mySecretKeyForJWT = 'JWTsecretKEY2019';
const cookieConfig = { httpOnly: true };


MongoClient.connect(uri, (err, client) => {
     if (err) return console.error('Não foi possível obter conexão com o Banco de Dados...', err);
     else console.log('Conectado ao Banco de Dados com sucesso!');

     // Cria uma nova coleção no banco de dados
     myDataBase = client.db('DataBase');

     // O servidor só é iniciado quando o banco de dados estiver conectado
     app.listen(3000, () => {
          console.log('Servidor rodando na porta 3000...');
     });
});



//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------   MIDDLEWARES  --------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
// Diretório para arquivos estáticos (CSS): /styles
app.use("/styles", express.static(__dirname + "/styles"));
// Body Parser para tratar dados advindos de formulários
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(cookieParser());

// Standard Error-Handler (manipulador de erro padrão)
app.use( function(err, req, res, next){
     if(err) console.error(err.stack);
     next();
});


//---------------------------------------------------------------------------------------
// MIDDLEWARE para autenticar acessos às páginas do sistema
var verifyJWT = function(req, res, next){
     console.log('Eu sou o middleware de autenticação das páginas do sistema!');

     var token = req.cookies.SecureTokenCookie;
     if(!token) return res.status(401).send({ auth: false, message: 'Autorização negada! Faça login no sistema.' });

     // Se o token existir, então ele é decodificado
     jwt.verify(token, mySecretKeyForJWT, function(err, decoded){
          if(err) return res.status(500).send({ auth: false, message: 'Não foi possível autenticar o token.'});
          req.userData = {
               id: decoded.id,
               nome: decoded.nome,
               sobrenome: decoded.sobrenome,
               perfil: decoded.perfil,
               especialidade: decoded.especialidade
          };
          console.log('Autorização concedida. Redirecionando para a página...');
          next();
     });
}



// View Engine: EJS
app.set('view engine', 'ejs');




//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------   MÉTODOS GET  --------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------



// PÁGINA DE LOGIN, PÁGINA INICIAL DO SISTEMA
app.get('/', (req, res) => {
     res.render('index.ejs');
});


//---------------------------------------------------------------------------------------
// LOGOUT DO SISTEMA
app.get('/logout', (req, res) => {
     res.clearCookie('SecureTokenCookie');
     console.log('Realizando logout do sistema... Cookie de autenticação destruído.');
     res.redirect('/');
});

//---------------------------------------------------------------------------------------
// PÁGINA CONSULTAS DO PACIENTE, ONDE MOSTRA OS DADOS DAQUELE PACIENTE E SUAS CONSULTAS
app.get('/area-paciente/consultas', verifyJWT, (req, res) => {
     
     // Se não tiver perfil de paciente, a autorização é negada
     if(req.userData.perfil != 'paciente') 
          return res.status(401).send({ auth: false, message: 'Autorização negada! Apenas pacientes podem acessar esta página.'});
     
     var id = req.userData.id;
     myDataBase.collection('usuarios').find().toArray((err, results) => {
          if (err) return console.error('Problema para resgatar informações de pacientes no Banco de Dados...', err);

          objPaciente = results.find(obj => obj._id == id);   // Objeto com todos os dados do paciente
          
          // Caso o paciente não possua agenda. Isso pode acontecer com um paciente recém cadastrado no sistema
          // Cria um array vazio só para constar.
          if(!objPaciente.agenda)
               objPaciente.agenda = new Array();

          // Varre a agenda do paciente salvando os IDs dos médicos das consultas marcadas
          var idsMedicos = new Array();
          var agenda = objPaciente.agenda;
          agenda.forEach( (consulta) => {
               let medico = consulta.idMedico;           // Pega o ID do médico que receitou aquele exame
               if( idsMedicos.indexOf(medico) < 0 ){   // Mas só insere no array se não for repetido
                    idsMedicos.push(medico);
               }
          });

          // Agora salva todas infos dos médicos das consultas marcadas
          var objMedicos = new Array();
          idsMedicos.forEach( (idMedico) => {
               let medico = results.find(obj => obj._id == idMedico);
               // Exclui dados desnecessários do médico para a área-paciente
               delete medico.perfil;
               delete medico.email;
               delete medico.nascimento;
               delete medico.telefone;
               delete medico.sexo;
               delete medico.senha;
               delete medico.endereco;
               delete medico.disponibilidade;
               delete medico.agenda;
               objMedicos.push(medico);
          });
          console.log(' ');
          console.log('SOLICITAÇÃO GET: Renderizando a página de um paciente (consultas)...');
          res.render('paciente-consultas.ejs', {moment: moment, paciente: objPaciente, medicos: objMedicos});
     });
});


//---------------------------------------------------------------------------------------
// PÁGINA EXAMES DO PACIENTE, ONDE MOSTRA OS EXAMES DAQUELE PACIENTE
app.get('/area-paciente/exames', verifyJWT, (req, res) => {

     // Se não tiver perfil de paciente, a autorização é negada
     if(req.userData.perfil != 'paciente') 
          return res.status(401).send({ auth: false, message: 'Autorização negada! Apenas pacientes podem acessar esta página.'});
     
     var id = req.userData.id;
     myDataBase.collection('usuarios').find().toArray((err, results) => {
          if (err) return console.error('Problema para resgatar informações de pacientes no Banco de Dados...', err);

          objPaciente = results.find(obj => obj._id == id);   // Objeto com todos os dados do paciente
          
          // Caso o paciente não possua agenda. Isso pode acontecer com um paciente recém cadastrado no sistema
          // Cria um array vazio só para constar.
          if(!objPaciente.exames)
               objPaciente.exames = new Array();

          // Varre array de exames do paciente salvando IDs dos médicos que pediram exames
          var idsMedicos = new Array();
          var exames = objPaciente.exames;
          exames.forEach( (exame) => {
               let medico = exame.idMedico;         // Pega o ID do médico daquela consulta
               if( idsMedicos.indexOf(medico) < 0 ){   // Mas só insere no array se não for repetido
                    idsMedicos.push(medico);
               }
          });

          // Varre array de exames do paciente salvando os IDs dos laboratórios onde fez exames
          var idsLabs = new Array();
          exames.forEach( (exame) => {
               let lab = exame.idLab;         // Pega o ID do médico daquela consulta
               if( idsLabs.indexOf(lab) < 0 ){   // Mas só insere no array se não for repetido
                    idsLabs.push(lab);
               }
          });

          // Salva infos básicas dos médicos dos exames solicitados
          var objMedicos = new Array();
          idsMedicos.forEach( (idMedico) => {
               let medico = results.find(obj => obj._id == idMedico);
               // Exclui dados desnecessários do médico para a área-paciente
               delete medico.perfil;
               delete medico.email;
               delete medico.nascimento;
               delete medico.telefone;
               delete medico.sexo;
               delete medico.senha;
               delete medico.endereco;
               delete medico.disponibilidade;
               delete medico.agenda;
               objMedicos.push(medico);
          });

          // Salva infos dos laboratórios
          var objLabs = new Array();
          idsLabs.forEach( (idLab) => {
               let lab = results.find(obj => obj._id == idLab);
               // Exclui dados desnecessários do lab
               delete lab.perfil;
               delete lab.senha;
               objLabs.push(lab);
          });
          console.log(' ');
          console.log('SOLICITAÇÃO GET: Renderizando a página de um paciente (exames)...');
          res.render('paciente-exames.ejs', {moment: moment, paciente: objPaciente, medicos: objMedicos, labs: objLabs});
     });
});


//---------------------------------------------------------------------------------------
// PÁGINA RECEITAS DO PACIENTE, ONDE MOSTRA AS RECEITAS PRESCRITAS PARA AQUELE PACIENTE
app.get('/area-paciente/receitas', verifyJWT, (req, res) => {

     // Se não tiver perfil de paciente, a autorização é negada
     if(req.userData.perfil != 'paciente') 
          return res.status(401).send({ auth: false, message: 'Autorização negada! Apenas pacientes podem acessar esta página.'});
     var id = req.userData.id;
     
     myDataBase.collection('usuarios').find().toArray((err, results) => {
          if (err) return console.error('Problema para resgatar informações de pacientes no Banco de Dados...', err);

          objPaciente = results.find(obj => obj._id == id);   // Objeto com todos os dados do paciente
          
          // Caso o paciente não possua medicamentos receitados. Isso pode acontecer com um paciente recém cadastrado no sistema
          // Cria um array vazio só para constar.
          if(!objPaciente.receitas)
               objPaciente.receitas = new Array();

          // Varre as receitas do paciente salvando os IDs dos médicos que fizeram as receitas
          var idsMedicos = new Array();
          var receitas = objPaciente.receitas;
          receitas.forEach( (receita) => {
               let medico = receita.idMedico;          // Pega o ID do médico daquela consulta
               if( idsMedicos.indexOf(medico) < 0 ){   // Mas só insere no array se não for repetido
                    idsMedicos.push(medico);
               }
          });

          // Agora salva todas infos dos médicos das consultas marcadas
          var objMedicos = new Array();
          idsMedicos.forEach( (idMedico) => {
               let medico = results.find(obj => obj._id == idMedico);
               // Exclui dados desnecessários do médico para a área-paciente
               delete medico.perfil;
               delete medico.email;
               delete medico.nascimento;
               delete medico.telefone;
               delete medico.sexo;
               delete medico.senha;
               delete medico.endereco;
               delete medico.disponibilidade;
               delete medico.agenda;
               objMedicos.push(medico);
          });
          console.log(' ');
          console.log('SOLICITAÇÃO GET: Renderizando a página de um paciente (receitas)...');
          res.render('paciente-receitas.ejs', {moment: moment, paciente: objPaciente, medicos: objMedicos});
     });
});


//---------------------------------------------------------------------------------------
// PÁGINA DE AGENDA DOS MÉDICOS, ONDE MOSTRA AS CONSULTAS AGENDADAS DE CADA MÉDICO
app.get('/agenda', verifyJWT, (req, res) => {
     var perfil = req.userData.perfil;
     // Se não tiver perfil de médico ou recepcionista, a autorização é negada
     if(perfil != 'medico' && perfil != 'recepcionista') 
          return res.status(401).send({ auth: false, message: 'Autorização negada! Apenas profissionais podem acessar esta página.'});

     myDataBase.collection('usuarios').find().toArray((err, results) => {
          if (err) return console.error('Problema para resgatar informações de pacientes no Banco de Dados...', err);

          // Criar um novo array e copia para ele apenas os perfis de médicos
          var medicosData = new Array();
          results.forEach( (data) => {
               if(data.perfil == 'medico')
                    medicosData.push(data);
          });

          res.render('agenda.ejs', {moment: moment, medicos: medicosData, sessionData: req.userData});
     });
});


//---------------------------------------------------------------------------------------
// PÁGINA DE DISPONIBILIDADE DOS MÉDICOS
app.get('/disponibilidade', verifyJWT, (req, res) => {
     var perfil = req.userData.perfil;
     // Se não tiver perfil de médico ou recepcionista, a autorização é negada
     if(perfil != 'medico' && perfil != 'recepcionista') 
          return res.status(401).send({ auth: false, message: 'Autorização negada! Apenas profissionais podem acessar esta página.'});

     myDataBase.collection('usuarios').find().toArray((err, results) => {
          if (err) return console.error('Problema para resgatar informações de pacientes no Banco de Dados...', err);

          // Criar um novo array e copia para ele apenas os perfis de médicos
          var medicosData = new Array();
          results.forEach( (data) => {
               if(data.perfil == 'medico')
                    medicosData.push(data);
          });
          res.render('disponibilidade.ejs', {moment: moment, medicos: medicosData, sessionData: req.userData});
     });
});


//---------------------------------------------------------------------------------------
// PÁGINA QUE MOSTRA TODOS OS MEDICAMENTOS CADASTRADOS NO SISTEMA
app.get('/medicamentos', verifyJWT, (req, res) => {
     var perfil = req.userData.perfil;
     // Se não tiver perfil de médico ou recepcionista, a autorização é negada
     if(perfil != 'medico' && perfil != 'recepcionista') 
          return res.status(401).send({ auth: false, message: 'Autorização negada! Apenas profissionais podem acessar esta página.'});

     myDataBase.collection('medicamentos').find().toArray((err, results) => {
          if (err) return console.error('Problema para resgatar informações de medicamentos no Banco de Dados...', err);
          res.render('medicamentos.ejs', {moment: moment, medicamentos: results, sessionData: req.userData});
     });
});


//---------------------------------------------------------------------------------------
// PÁGINA COM EXAMES DISPONÍVEIS PARA SEREM SOLICITADOS
app.get('/exames', verifyJWT, (req, res) => {
     var perfil = req.userData.perfil;
     // Se não tiver perfil de médico ou recepcionista, a autorização é negada
     if(perfil != 'medico') 
          return res.status(401).send({ auth: false, message: 'Autorização negada! Apenas médicos podem acessar esta página.'});

     myDataBase.collection('exames').find().toArray((err, results) => {
          if (err) return console.error('Problema para resgatar informações de medicamentos no Banco de Dados...', err);
          res.render('exames.ejs', {moment: moment, exames: results, sessionData: req.userData});
     });
});



//---------------------------------------------------------------------------------------
// PÁGINA USUÁRIOS, ONDE MOSTRA OS PACIENTES CADASTRADOS
app.get('/usuarios/pacientes', verifyJWT, (req, res) => {
     var perfil = req.userData.perfil;
     // Se não tiver perfil de recepcionista, a autorização é negada
     if(perfil != 'recepcionista') 
          return res.status(401).send({ auth: false, message: 'Autorização negada! Apenas profissionais podem acessar esta página.'});

     myDataBase.collection('usuarios').find().toArray((err, results) => {
          if (err) return console.error('Problema para resgatar informações de pacientes no Banco de Dados...', err);

          // Criar um novo array e copia para ele apenas os perfis pacientes
          var pacientesData = new Array();
          results.forEach( (data) => {
               if(data.perfil == 'paciente')
                    pacientesData.push(data);
          });
          res.render('usuarios-pacientes.ejs', {pacientes: pacientesData, sessionData: req.userData});
     });
});


//---------------------------------------------------------------------------------------
// PÁGINA PROFISSIONAIS, ONDE MOSTRA OS PROFISSIONAIS DA CLÍNOCA
app.get('/usuarios/profissionais', verifyJWT, (req, res) => {
     var perfil = req.userData.perfil;
     // Se não tiver perfil de recepcionista, a autorização é negada
     if(perfil != 'recepcionista') 
          return res.status(401).send({ auth: false, message: 'Autorização negada! Apenas profissionais podem acessar esta página.'});
     
     myDataBase.collection('usuarios').find().toArray((err, results) => {
          if (err) return console.error('Problema para resgatar informações de profissionais no Banco de Dados...', err);

          // Criar um novo array e copia para ele apenas os perfis de profissionais (med, recep, lab)
          var profissionaisData = new Array();
          results.forEach( (data) => {
               if( data.perfil == 'medico' || data.perfil == 'recepcionista' || data.perfil == 'laboratorio')
                    profissionaisData.push(data);
          });
          res.render('usuarios-profissionais.ejs', {profissionais: profissionaisData, sessionData: req.userData});
     });
});


//---------------------------------------------------------------------------------------
// PÁGINA VISÍVEL SOMENTE PARA OS MÉDICOS ONDE MOSTRA O HISTÓRICO DE CONSULTAS DE UM PACIENTE
app.get('/pacientes/consultas', verifyJWT, (req, res) => {
     var perfil = req.userData.perfil;
     // Se não tiver perfil de médico, a autorização é negada
     if(perfil != 'medico') 
          return res.status(401).send({ auth: false, message: 'Autorização negada! Apenas profissionais podem acessar esta página.'});

     myDataBase.collection('usuarios').find().toArray((err, results) => {
          if (err) return console.error('Problema para resgatar informações de profissionais no Banco de Dados...', err);

          // Criar um novo array e copia para ele apenas os perfis de pacientes
          var pacientesData = new Array();
          results.forEach( (data) => {
               if( data.perfil == 'paciente' )
               pacientesData.push(data);
          });
          res.render('pacientes-consultas.ejs', {pacientes: pacientesData, sessionData: req.userData});
     });
});


//---------------------------------------------------------------------------------------
// RESPONDE COM UM OBJETO CONTENDO --TODOS-- OS DADOS DE APENAS UM USUÁRIO DESEJADO, SEJA ELE PACIENTE OU MÉDICO
app.get("/usuario/get/:id", (req, res) => {
     var id = req.params.id;
     console.log(' ');
     console.log('Solicitação GET: DADOS DE UM USUÁRIO...');

     myDataBase.collection('usuarios').find('').toArray((err, results) => {
          if (err) return res.send(500, err);
          
          let objUsuario = results.find(obj => obj._id == id);
          res.status(200).send(objUsuario);
     });
});


//---------------------------------------------------------------------------------------
// RESPONDE COM UM OBJETO CONTENDO --TODOS-- OS DADOS DE APENAS UM MEDICAMENTO DESEJADO
app.get("/medicamento/get/:id", (req, res) => {
     var id = req.params.id;
     console.log(' ');
     console.log('Solicitação GET: DADOS DE UM MEDICAMENTO...');

     myDataBase.collection('medicamentos').find('').toArray((err, results) => {
          if (err) return res.send(500, err);
          
          let objMedicamento = results.find(obj => obj._id == id);
          res.status(200).send(objMedicamento);
     });
});


//---------------------------------------------------------------------------------------
// RESPONDE COM NOME, SOBRENOME E DATA DE NACIMENTO DE --TODOS-- OS PACIENTES
// "min" = responde somente com o mínimo de informação dos usuários
app.get("/usuarios/pacientes/min/get", (req, res) => {
     console.log(' ');
     console.log('Solicitação GET: DADOS MÍNIMOS DE TODOS PACIENTES...');

     myDataBase.collection('usuarios').find('').toArray((err, results) => {
          if (err) return res.send(500, err);
          
          var objPacientes = new Array();
          results.forEach( (value) => {
               if( value.perfil == 'paciente'){
                    let pacienteMin = {
                         'id': value._id,
                         'nome': value.nome,
                         'sobrenome': value.sobrenome,
                         'nascimento': value.nascimento
                    };
                    objPacientes.push(pacienteMin);
               }
          });
          res.status(200).send(objPacientes);
     });
});


//---------------------------------------------------------------------------------------
// RESPONDE COM UM OBJETO CONTENDO --TODOS-- OS EXAMES GRAVADOS NO BANCO DE DADOS
app.get("/usuarios/labs/min/get", (req, res) => {
     console.log(' ');
     console.log('Solicitação GET: DADOS MÍNIMOS DE TODOS LABORATÓRIOS...');

     myDataBase.collection('usuarios').find('').toArray((err, results) => {
          if (err) return res.send(500, err);
          
          // Criar um novo array e copia para ele apenas os perfis de LABORATORIOS
          var objLabs = new Array();
          results.forEach( (value) => {
               if(value.perfil == 'laboratorio'){
                    let labInfo = { 'id': value._id, 'nome': value.nome };
                    objLabs.push(labInfo);
               }
          });
          res.status(200).send(objLabs);
     });
});
//---------------------------------------------------------------------------------------
// ENVIA UM ARRAY DE OBJETOS CONTENDO TODOS OS DADOS DE UM MÉDICO E DE TODOS OS PACIENTES QUE POSSUEM
// CONSULTA MARCADA COM AQUELE MÉDICO
app.get("/consultas/:id", (req, res) => {
     var id = req.params.id;
     var idsPacientes = new Array();
     var resMedicoPacientes = new Array();

     console.log(' ');
     console.log('Solicitação GET: AGENDA DO MÉDICO...');

     myDataBase.collection('usuarios').find('').toArray((err, results) => {
          if (err) return res.send(500, err);
          
          objMedico = results.find(obj => obj._id == id);   // Objeto com todos os dados do médico
          
          // Caso o médico não possua agenda. Isso pode acontecer com um médico recém cadastrado no sistema
          if(!objMedico.agenda)
               objMedico.agenda = new Array();

          var agenda = objMedico.agenda;                    // Pega Array agenda
          agenda.forEach( (consulta) => {
               let paciente = consulta.idPaciente;          // Salva o ID do paciente daquela consulta
               if( idsPacientes.indexOf(paciente) < 0 ){    // Só insere se não for repetido
                    idsPacientes.push(paciente);
               }
          });

          resMedicoPacientes.push(objMedico);               // Insere primeiro os dados do médico
          idsPacientes.forEach( (idPaciente) => {           // E depois vai adicionando os pacientes
               let objPaciente = results.find(obj => obj._id == idPaciente);
               resMedicoPacientes.push(objPaciente);
          });

          // Envia resposta contendo os dados do Médico e de todos Pacientes que possuem
          // consulta marcada com aquele médico
          res.status(200).send(resMedicoPacientes);

     });
});



//---------------------------------------------------------------------------------------
// ENVIA UM ARRAY DE OBJETOS CONTENDO TODOS OS DADOS DE UM PACIENTE E DE TODOS OS MÉDICOS QUE ELE POSSUI
// ALGUMA CONSULTA MARCADA
app.get("/paciente/consultas/:id", (req, res) => {
     var id = req.params.id;
     var idsMedicos = new Array();
     var resPacienteMedicos = new Array();

     console.log(' ');
     console.log('Solicitação GET: AGENDA DE UM PACIENTE...');

     myDataBase.collection('usuarios').find('').toArray((err, results) => {
          if (err) return res.send(500, err);
          
          objPaciente = results.find(obj => obj._id == id);   // Objeto com todos os dados do médico
          
          // Caso o médico não possua agenda. Isso pode acontecer com um médico recém cadastrado no sistema
          if(!objPaciente.agenda)
               objPaciente.agenda = new Array();

          var agenda = objPaciente.agenda;              // Pega Array agenda
          agenda.forEach( (consulta) => {
               let medico = consulta.idMedico;          // Salva o ID do paciente daquela consulta
               if( idsMedicos.indexOf(medico) < 0 )     // Só insere se não for repetido
                    idsMedicos.push(medico);
          });

          // Retira informações confidenciais e desnecessárias para a operação
          delete objPaciente.email;
          delete objPaciente.senha;
          delete objPaciente.endereco;
          delete objPaciente.nascimento;
          delete objPaciente.telefone;
          resPacienteMedicos.push(objPaciente);               // Insere primeiro os dados do médico
          idsMedicos.forEach( (idMedico) => {           // E depois vai adicionando os pacientes
               let objMedico = results.find(obj => obj._id == idMedico);
               let obj = {
                    'id': objMedico._id,
                    'nome': objMedico.nome,
                    'sobrenome': objMedico.sobrenome,
                    'especialidade': objMedico.especialidade,
                    'crm': objMedico.crm
               };
               resPacienteMedicos.push(obj);
          });

          // Envia resposta contendo os dados do Médico e de todos Pacientes que possuem
          // consulta marcada com aquele médico
          res.status(200).send(resPacienteMedicos);

     });
});


//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//----------------------------------  MÉTODOS POST  -------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------


//---------------------------------------------------------------------------------------
//
app.post('/login', (req, res) => {
     var email = req.body.email;
     var password = req.body.password;

     console.log(' ');
     console.log('Dados de entrada para login:');
     console.log(req.body);

     myDataBase.collection('usuarios').find({'email': email} ).toArray((err, result) => {
          if(err) throw err;
          
          var objUsuario = result[0];
          console.log(' ');
     
          // Se o e-mail não estiver cadastrado
          if(typeof objUsuario == 'undefined'){
               console.log("O usuário não está cadastrado no Banco de Dados.");
               return res.status(500).end(); // Usuário não cadastrado
          }
          else{
               console.log("O usuário está cadastrado no Banco de Dados.");
               bcrypt.compare(password, objUsuario.senha, function(err, result) {
                    if(err) throw err;
                    
                    // Senha correta
                    if(result === true){
                         //Cria JSON Web Token
                         var payload = {
                              id: objUsuario._id,
                              nome: objUsuario.nome,
                              sobrenome: objUsuario.sobrenome,
                              perfil: objUsuario.perfil
                         };
                         if(objUsuario.perfil == 'medico') payload.especialidade = objUsuario.especialidade;
                         var token = jwt.sign(payload, mySecretKeyForJWT,{ expiresIn: '1h' });

                         // Cria cookie HttpOnly com o token gerado
                         res.cookie('SecureTokenCookie', token, cookieConfig);

                         console.log("A senha está correta.");
                         console.log("Um cookie foi criado contendo o token para o usuário");
                         res.status(200).send({ 'perfil': objUsuario.perfil});
                    }
                    // Senha falsa
                    else{
                         console.log("A senha digitada é inválida.");
                         res.status(500).end();
                    }
               });
          }
     
     });
});


//---------------------------------------------------------------------------------------
// 
app.post('/usuario/cadastrar', async function(req, res){
     
     console.log(' ');
     console.log('CADASTRAR NOVO USUÁRIO...');
     
     var formData = req.body;

     // Cria um obj com todos dados do endereço dentro
     formData.endereco = {
          'logradouro': formData.logradouro,
          'numero': formData.numero,
          'bairro': formData.bairro,
          'cidade': formData.cidade,
          'uf': formData.uf,
          'cep': formData.cep
     };

     // Esses dados já estão no objeto endereco. Não são mais necessários
     delete formData.logradouro;
     delete formData.numero;
     delete formData.bairro;
     delete formData.cidade;
     delete formData.uf;
     delete formData.cep;
     
     // Criptografa a senha
     bcrypt.hash(formData.senha, SALT_ROUNDS, (err, hash) => {
          if(err) throw err;
          formData.senha = hash;

          myDataBase.collection('usuarios').insertOne(formData, (err, result) => {
               if(err) throw err;
               else console.log('Novo usuário cadastrado com sucesso...');
          });
          // Redireciona para a página correta com parâmetros de URL
          if(formData.perfil == 'paciente')
               res.redirect('/usuarios/pacientes?created=success');
          else
               res.redirect('/usuarios/profissionais?created=success');
     });
});


//---------------------------------------------------------------------------------------
// 
app.post('/medicamentos/cadastrar', (req, res) => {
     
     console.log(' ');
     console.log('CADASTRAR NOVO MEDICAMENTO...');

     var formData = req.body;

     // Envia para o Banco de Dados
     myDataBase.collection('medicamentos').insertOne(formData, (err, result) => {
          if(err) throw err;
          else console.log('Novo medicamento cadastrado com sucesso...');
          res.redirect('/medicamentos?created=success');
     });

});


//---------------------------------------------------------------------------------------
//
app.post('/usuario/editar/:id', (req, res) => {
     var formData = req.body;
     console.log("Novos dados a editar: ");
     console.log(formData);

     if(formData.perfil=='paciente' || formData.perfil=='medico' || formData.perfil=='recepcionista'){
          myDataBase.collection('usuarios').updateOne(
               { '_id': ObjectID(req.params.id) },
               { $set:
                    {
                         'nome': formData.nome,
                         'sobrenome': formData.sobrenome,
                         'email': formData.email,
                         'nascimento': formData.nascimento,
                         'telefone': formData.telefone,
                         'sexo': formData.sexo,
                         'endereco': 
                              {
                                   'logradouro': formData.logradouro,
                                   'numero': formData.numero,
                                   'bairro': formData.bairro,
                                   'cidade': formData.cidade,
                                   'uf': formData.uf,
                                   'cep': formData.cep 
                              } 
                    }
               },
               (err, result) => {
                    if (err) throw err;
                    else console.log('Atualizando dados - função 01');
               }
          );
     }
     if(formData.perfil == 'paciente') {
          myDataBase.collection('usuarios').updateOne(
               { '_id': ObjectID(req.params.id) },
               { $set: 
                    { 
                         'convenio': formData.convenio 
                    } 
               },
               (err, result) => {
                    if (err) throw err;
                    else console.log('Atualizando dados - função 02');
          });
     }
     if(formData.perfil == 'medico') {
          myDataBase.collection('usuarios').updateOne(
               { '_id': ObjectID(req.params.id) },
               { $set:   
                    { 
                         'especialidade': formData.especialidade,
                         'crm': formData.crm 
                    } 
               },
               (err, result) => {
                    if (err) throw err;
                    else console.log('Atualizando dados - função 03');
          });
     }
     if(formData.perfil == 'laboratorio') {
          myDataBase.collection('usuarios').updateOne(
               { '_id': ObjectID(req.params.id) },
               { $set: 
                    {
                         'nome': formData.nome,
                         'email': formData.email,
                         'telefone': formData.telefone,
                         'endereco': 
                              {
                                   'logradouro': formData.logradouro,
                                   'numero': formData.numero,
                                   'bairro': formData.bairro,
                                   'cidade': formData.cidade,
                                   'uf': formData.uf,
                                   'cep': formData.cep 
                              } 
                    } },
               (err, result) => {
                    if (err) throw err;
                    else console.log('Atualizando dados de laboratório');
          });
     }

     if(formData.perfil == 'paciente')
          res.redirect('/usuarios/pacientes?edited=success');
     else
          res.redirect('/usuarios/profissionais?edited=success');
});

//---------------------------------------------------------------------------------------
//
app.post('/medicamento/editar/:id', (req, res) => {
     var formData = req.body;
     
     console.log(' ');
     console.log("Novos dados a editar: ");
     console.log(formData);

     myDataBase.collection('medicamentos').updateOne(
          { '_id': ObjectID(req.params.id) },
          { $set:
               {
                    'produto': formData.produto,
                    'principio': formData.principio,
                    'apresentacao': formData.apresentacao,
                    'fabricante': formData.fabricante
               }
          },
          (err, result) => {
               if (err) throw err;
               else console.log('Sucesso em atualizar dados do medicamento.');
               res.redirect('/medicamentos?edited=success');
          }
     );
});


//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//----------------------------------  MÉTODOS PUT  -------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------


//---------------------------------------------------------------------------------------
// 
app.put('/medicamentos/receitar/:id', (req, res) => {
     console.log(' ');
     console.log('RECEITANDO MEDICAMENTOS...');

     var idPaciente = req.params.id;
     var obj = {
               'idMedico': req.body.idMedico,
               'medicamentos': req.body.medicamentos,
               'obs': req.body.obs,
               'data': req.body.data
     };

     console.log(' ');
     console.log('EMITIR NOVA RECEITA...');
     console.log('Paciente: ', idPaciente);
     console.log('Médico: ', obj.idMedico);
     console.log('Medicamentos: ', obj.medicamentos);
     console.log('Observações: ', obj.obs);
     console.log('Data: ', obj.data);

     // Adiciona receita para o paciente
     myDataBase.collection('usuarios').updateOne(
          { '_id': ObjectID(idPaciente) },
          { $push:{ 'receitas': obj } },
          (err, result) => {
               if (err) throw err;
               else console.log("Receita prescrita com sucesso para o paciente!");
               res.status(200).send('Receita prescrita com sucesso!');
          }
     );

});


//---------------------------------------------------------------------------------------
// 
app.put('/exames/solicitar/:id', (req, res) => {
     var idPaciente = req.params.id;
     var obj = {
               'data': req.body.data,
               'idMedico': req.body.idMedico,
               'idLab': req.body.idLab,
               'pedidos': req.body.pedidos,
               'disponivel': false,
               'visivel': false
     };

     console.log(' ');
     console.log('SOLICITAR EXAMES...');
     console.log('Data: ', obj.data);
     console.log('Paciente: ', idPaciente);
     console.log('Médico: ', obj.idMedico);
     console.log('Laboratório: ', obj.idLab);
     console.log('Exames Solicitados: ', obj.pedidos);

     // Adiciona receita para o paciente
     myDataBase.collection('usuarios').updateOne(
          { '_id': ObjectID(idPaciente) },
          { $push:{ 'exames': obj } },
          (err, result) => {
               if (err) throw err;
               else console.log("Exames solicitados com sucesso para o paciente e para o laboratório!");
               res.status(200).send('Exames solicitados com sucesso!');
          }
     );

});

//---------------------------------------------------------------------------------------
//
app.put('/consulta/marcar/:id', (req, res) => {
     var obj = {
               'idMedico': req.params.id,
               'idPaciente': req.body.idPaciente,
               'dataHora': req.body.dataHora
     };

     console.log(' ');
     console.log('MARCAR CONSULTA...');
     console.log('Paciente: ', obj.idPaciente);
     console.log('Data e hora da consulta: ', obj.dataHora);

     // Adiciona a consulta na agenda do médico
     function marcarConsultaMedico( obj ){
          return new Promise(function(resolve, reject){
               var objConsulta = {
                    'idPaciente': obj.idPaciente,
                    'dataHora': obj.dataHora
               };
               myDataBase.collection('usuarios').updateOne(
                    { '_id': ObjectID(obj.idMedico) },
                    { $push:{ 'agenda': objConsulta } },
                    (err, result) => {
                         if (err) throw err;
                         else{
                              console.log("Consulta marcada com sucesso na agenda do médico!");
                              resolve(obj);
                         }
                    }
               );
          });
     }
     // Adiciona a consulta na agenda do paciente
     function marcarConsultaPaciente( obj ){
          return new Promise(function(resolve, reject){
               var objConsulta = {
                    'idMedico': obj.idMedico,
                    'dataHora': obj.dataHora
               };
               myDataBase.collection('usuarios').updateOne(
                    { '_id': ObjectID(obj.idPaciente) },
                    { $push:{ 'agenda': objConsulta } },
                    (err, result) => {
                         if (err) throw err;
                         else{
                              console.log("Consulta marcada com sucessona agenda do paciente!");
                              res.status(200).send('Consulta marcada com sucesso!');
                         }
                    }
               );
          });
     }
     marcarConsultaMedico(obj).then(marcarConsultaPaciente);
});


//---------------------------------------------------------------------------------------
//
app.put('/consulta/desmarcar/:id', (req, res) => {
     var obj = {
          'idMedico': req.params.id,
          'idPaciente': req.body.idPaciente,
          'dataHora': req.body.dataHora
     };

     console.log(' ');
     console.log('DESMARCAR CONSULTA...');
     console.log('Medico: ', obj.idMedico);
     console.log('Paciente: ', obj.idPaciente);
     console.log('Data e hora da consulta:', obj.dataHora);

     // Desmarca a consulta na agenda do médico
     function desmarcarConsultaMedico( obj ){
          return new Promise(function(resolve, reject){
               myDataBase.collection('usuarios').updateOne(
                    { '_id': ObjectID(obj.idMedico) },
                    { $pull: { 'agenda': { dataHora: obj.dataHora } } },
                    (err, result) => {
                         if (err) throw err;
                         else{
                              console.log("Consulta removida com sucesso da agenda do médico!");
                              resolve(obj);
                         }
                    }
               );
          });
     }
     // Desmarca a consulta na agenda do paciente
     function desmarcarConsultaPaciente( obj ){
          return new Promise(function(resolve, reject){
               myDataBase.collection('usuarios').updateOne(
                    { '_id': ObjectID(obj.idPaciente) },
                    { $pull: { 'agenda': { dataHora: obj.dataHora } } },
                    (err, result) => {
                         if (err) throw err;
                         else{
                              console.log("Consulta removida com sucesso da agenda do paciente!");
                              res.status(200).send('Consulta removida com sucesso!');
                         }
                    }
               );
          });
     }
     desmarcarConsultaMedico(obj).then(desmarcarConsultaPaciente);
});


//---------------------------------------------------------------------------------------
//
app.put('/disponibilidade/adicionar/:id', (req, res) => {
     
     // Esta função insere no banco de dados o Array dispon junto das disponibilidades já marcadas
     var inserirDisponibilidade = function( dispon ){
          return new Promise(function(resolve, reject){
               myDataBase.collection('usuarios').updateOne(
                    { '_id': ObjectID(req.params.id) },
                    { $push:{ 'disponibilidade': { $each: dispon } } },
                    (err, result) => {
                         if (err) throw err;
                         else{ 
                              console.log('Disponibilidade inserida no DB...');
                              res.status(200).send('Disponibilidade adicionada no DB!');
                         }
               });
               resolve();
          });     
     }
     // Esta função vê quais datas/horários já possuem disponibilidade marcada
     // Remove do Array as repetidas p/ não serem inseridas duas vezez
     function filtrarDisponRepetida( [dispon, disponibilidade] ){
          return new Promise(function(resolve, reject){
               // Faz TESTE para ver se há datas iguais com disponibilidades já marcadas
               var keys = new Array();
               for(var i = 0; i < dispon.length; i++){
                    for(var j = 0; j < disponibilidade.length; j++){
                         if(dispon[i] == disponibilidade[j])
                              keys.push(i);
                    }
               }
               // Arranca do vetor os que eram iguais
               keys.forEach( (value, i) => {
                    dispon.splice(value-i, 1);
               });
               // Retorna array filtrado a segunda vez
               resolve(dispon);
          });
     }
     // Esta função vê quais datas/horários já possuem consulta marcada
     // Remove do Array se houver alguma data coincidente
     function filtrarConsultasMarcadas( dispon, consultasMarcadas, disponibilidade ){
          return new Promise(function(resolve, reject){
               // Faz TESTE para ver se há datas/horários iguais com consultas já marcadas
               var keys = new Array();
               for(var i = 0; i < dispon.length; i++){
                    for(var j = 0; j < consultasMarcadas.length; j++){
                         if(dispon[i] == consultasMarcadas[j].dataHora)
                              keys.push(i);
                    }
               }
               // Arranca do vetor os horárioss que eram iguais (não pode adicionar)
               keys.forEach( (value, i) => {
                    dispon.splice(value-i, 1);
               });
               // Retorna array filtrado e repassa a disponibilidade que já existia anteriormente
               resolve( [dispon, disponibilidade] );
          });
     }


     // Início da execução... Começa buscando no DB os dados do médico selecionado
     console.log(' ');
     console.log('ADICIONAR DISPONIBILIDADE...');
     var id = req.params.id;
     var dispon = req.body.dispon;           // Solicitação enviada pelo usuário

     myDataBase.collection('usuarios').find( {'_id': ObjectID(id)} ).toArray((err, result) => {
          if (err) return res.send(500, err);
          var obj = result[0];                         // Objeto com infos do Médico desejado
          var agenda = obj.agenda;                     // Agenda do médico (Array)
          var disponibilidade = obj.disponibilidade;   // Disponibilidade do médico (Array)
          // Confere se o médico possui a propriedade "agenda" já criada em seu documento
          // Se não tiver, inicializa o vetor vazio.
          if(agenda === undefined){
               console.log("Esse médico não possui nenhum registro de consulta...");
               agenda = [];
          }
          // Confere se o médico possui a propriedade "disponibilidade" já criada em seu documento
          // Se não tiver, inicializa um vetor vazio.
          if(disponibilidade === undefined){
               console.log("Esse médico não possui nenhum registro de disponibilidade... teremos que criar.");
               disponibilidade = [];
          }
          // Filtra o vetor dispon e depois insere as disponibilidades no banco de dados
          // Chama funções Promessa em ordem obrigatória de execução
          filtrarConsultasMarcadas(dispon, agenda, disponibilidade)
               .then(filtrarDisponRepetida)
               .then(inserirDisponibilidade);
     
     });

});


//---------------------------------------------------------------------------------------
//
app.put('/disponibilidade/remover/:id', (req, res) => {
     var id = req.params.id;
     var dataHoraRemover = req.body.dataHora;
     
     console.log(' ');
     console.log('REMOVER DISPONIBILIDADE...');
     console.log("Médico: ", id);
     console.log("Disponibilidade a ser removida: ", dataHoraRemover);

     function atualizarDisponibilidade( id, disponibilidade ){
          return new Promise(function(resolve, reject){
               myDataBase.collection('usuarios').updateOne(
                    { '_id': ObjectID(req.params.id) },
                    { $set: { 'disponibilidade': disponibilidade } },
                    (err, result) => {
                         if (err) throw err;
                         else {
                              console.log('Disponibilidade removida com sucesso!');
                              res.status(200).send('Disponibilidade removida com sucesso!');
                         }
                    }
               );
          });
     }

     myDataBase.collection('usuarios').find( {'_id': ObjectID(id)} ).toArray((err, result) => {
          if (err) return res.send(500, err);

          var obj = result[0];
          var disponibilidade = obj.disponibilidade;
          var index = disponibilidade.indexOf(dataHoraRemover);       // Acha posição no vetor onde está a data/hora desejada
          disponibilidade.splice(index, 1);                           // Retira a data/hora do vetor

          atualizarDisponibilidade(id, disponibilidade);              // Chama função para atualizar o novo vetor de disponibilidades
     });
  
});





//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//----------------------------------   MÉTODOS DELETE   ---------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------

//---------------------------------------------------------------------------------------
//
app.delete('/usuario/deletar/:id', (req, res) => {
     console.log(' ');
     console.log('DELETAR USUÁRIO...');
     myDataBase.collection('usuarios').deleteOne(
          { '_id': ObjectID(req.params.id) }, (err, result) => {
               if(err) throw err;
               console.log('Paciente deletado do Banco de Dados...');
          }
     );
     res.status(200).send('Paciente deletado!');
});


//---------------------------------------------------------------------------------------
//
app.delete('/medicamento/deletar/:id', (req, res) => {
     console.log(' ');
     console.log('DELETAR MEDICAMENTO...');

          myDataBase.collection('medicamentos').deleteOne( 
               { '_id': ObjectID(req.params.id) }, (err, result) => {
                    if(err) throw err;
                    console.log('Medicamento deletado do Banco de Dados...');
               } 
          );
     res.status(200).send('Medicamento deletado com sucesso do Banco de Dados.');
});

