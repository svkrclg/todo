const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const util = require("./util");
const cookieParser = require('cookie-parser');
const randomstring = require("randomstring");
const e = require('express');
const Busboy = require('busboy');
const fs = require('fs')


const app = express();
const port = 3000;
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
//setup public folder
app.use(express.static('./public'));
//use express-session
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());
app.use(cookieParser())

//middle-ware for routes
app.use((req, res, next) => {
  console.log(req.path)
  
  if(req.method == "GET" && (req.path == '/register' || req.path == '/login')){
    logged_in(req, 1, ()=> {
      console.log("logged_in")
      res.redirect('/')
    }, next);
  }
  else if(req.method == "GET" && (req.path == '/') ){
    logged_in(req, 0, ()=>{
      console.log("logged out")
      res.redirect('/login')
    }, next)
  }
  else
    next();
})

app.get('/',function (req, res) {
  util.get_current_user_promise(req).then((user) => {
    username = JSON.parse(user).username;
    return util.get_tasks_promise(username)
  }).then((tasks) => {
    console.log(tasks)
    res.render('pages/home', {name: username, tasks : tasks })
  }).catch((err) => {
    console.log(err)
    res.render('pages/home', {name: "user"})
  })
});

app.get('/login', (req, res) => {
  res.render('pages/login')
})

app.post('/auth', function(req, res){
  var username = req.body.username;
  var password = req.body.password;
  if (username && password) {
		util.db_conn.query('SELECT id FROM users WHERE username = ? AND password = ?', [username, password], function(error, results, fields) {
			if (results.length == 1) {
        auth_token = randomstring.generate()
        res.cookie('auth_token',auth_token, { maxAge: 12000000, httpOnly: true });
        var obj = {
          id: results[0].id, 
          username: username
        }
        util.set_redis_key(auth_token, JSON.stringify(obj), function(err, reply){
          if(err) {
            res.send("error in redis")
            console.log(err)
          }
          else
            res.redirect('/')
        })
			} else {
				res.send('Incorrect Username and/or Password!');
			}			
		});
	} else {
		res.send('Please enter Username and Password!');
	}
})

app.get('/register', (req, res) => {
  res.render('pages/register')
})

app.post('/register', (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  var cnf_pwd = req.body.cnf_password;
  console.log(username, password, cnf_pwd)
  if (username && password && cnf_pwd && cnf_pwd == password) {
    util.insert_user_promise(username, password).then(function(row){
      id = row[0]["id"]
      auth_token = randomstring.generate()
      res.cookie('auth_token',auth_token, { maxAge: 12000000, httpOnly: true });
      util.set_redis_key(auth_token,  JSON.stringify({ id: id, username: username }), function(err, reply){
          if(err) {
            res.send("error in redis")
            console.log(err)
          }
          else
            res.redirect('/')
        })
    }).catch((err) => {
      console.log(err)
      res.redirect('/register')
    })
	} else {
		res.redirect('/register')
	}
})

app.get('/logout', (req, res) => {
  res.clearCookie("auth_token")
  util.del_redis_key(req.cookies.auth_token, function(err,reply){
      res.redirect('/login')
  })
})

function logged_in(req, count, cb, next) {
  console.log("in f")
  if(req.cookies.auth_token != undefined) {
    util.get_redis_key(req.cookies.auth_token, function(err, reply){
      if(err)
        next()
      else {
        console.log(reply)
      util.db_conn.query("SELECT * from users where id = ?", [JSON.parse(reply).id], function(error, results, fields){
        console.log(results)
        if (results.length == count )
          cb()
        else
          next()
      })
    }
    })
  } 
  else
    count == 1 ? next() : cb()
}


//todo api

app.get('/file/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'uploads/'+req.params.id));
})
app.post('/create_task', (req, res) => {
  var busboy = new Busboy({ headers: req.headers });
  var formdata = {};
    busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
      var name = randomstring.generate() + "." + filename.split('.').pop();
      formdata.attachment = name
      var saveTo = path.join(__dirname, 'uploads/' + name);
      file.pipe(fs.createWriteStream(saveTo));
    });
    busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
        val = fieldname == "assignee" ? val.toLowerCase() : val
        formdata[`${fieldname}`] = val;
    });
    busboy.on('finish', function() {
      console.log('Done parsing form!', formdata);
      util.get_current_user_promise(req).then((reply) => {
        console.log("redis reply", reply)
        username = JSON.parse(reply).username;
        return util.insert_task_promise(username, formdata)
      }).then((result) => {
        res.send("1")
      }).catch((err) => {
        console.log(err)
        res.send("0")
      })
    });
    req.pipe(busboy);
})

app.post('/edit_task', (req, res) => {
  var busboy = new Busboy({ headers: req.headers });
  var formdata = {};
    busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
      if(filename.length > 0 ) {
      var name = randomstring.generate() + "." + filename.split('.').pop();
      formdata.attachment = name
      var saveTo = path.join(__dirname, 'uploads/' + name);
      file.pipe(fs.createWriteStream(saveTo));
      }
    });
    busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
        val = fieldname == "assignee" ? val.toLowerCase() : val
        formdata[`${fieldname}`] = val;
    });
    busboy.on('finish', function() {
      console.log('Done parsing form!', formdata);
      util.get_current_user_promise(req).then((reply) => {
        console.log("redis reply", reply)
        username = JSON.parse(reply).username;
        return util.edit_task_promise(username, formdata)
      }).then((result) => {
        res.send("1")
      }).catch((err) => {
        console.log(err)
        res.send("0")
      })
    });
    req.pipe(busboy);
})

app.delete('/delete_task/:id', (req, res) => {
  console.log("hello")
  var id = req.params.id
  util.db_conn.query("DELETE from task where id = ?", [id], function(err, results, field){
    if(err)
      res.send(0)
    else
      res.send("1")
  })
})


app.listen(port, () => console.log(`Todo app Started on port ${port}!`));
