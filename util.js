const mysql = require('mysql');
var redis = require('redis');
const { query } = require('express');
const { format } = require('path');
const db_conn = () => {
 return  mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'todo'
  });
}
exports.db_conn = db_conn()

function set_redis_key (key, value, cb){
    var client = redis.createClient();
    client.on('connect', function() {
      console.log('connected');
      client.set(key, value, function(err, reply){
        cb(err, reply)
      })
    });
}
module.exports.set_redis_key = function (key, value, cb){
  var client = redis.createClient();
  client.on('connect', function() {
    console.log('connected');
    client.set(key, value, function(err, reply){
      client.end()
      cb(err, reply)
    })
  });
}

module.exports.get_redis_key = function(key, cb){
  var client = redis.createClient();
  client.on('connect', function() {
    console.log('connected');
    client.get(key, function(err, reply){
      client.end()
      cb(err, reply)
    })
  });
}

module.exports.del_redis_key = function(key, cb){
  var client = redis.createClient();
  client.on('connect', function() {
    console.log('connected');
    client.del(key, function(err, reply){
      client.end()
      cb(err, reply)
    })
  });
}

module.exports.insert_user_promise = function(username, password) {
  return new Promise(function(resolve, reject){
    db_conn().query('insert into users(username, password) VALUES (?, ?)', [username, password], function(err, result, field){
      if(err){
        return reject(err)
      }
      db_conn().query("select id from users where username = ?", [username], function(err, result, field){
        if(err)
          return reject(err)
        else
          resolve(result)
      })
    })
  })
}

module.exports.get_current_user = function(req, cb){
  var client = redis.createClient();
  client.on('connect', function() {
    console.log('connected');
    client.get(req.cookies.auth_token, function(err, reply){
      client.end()
      cb(err, reply)
    })
  });
}

module.exports.get_current_user_promise = function(req) {
  return new Promise(function(resolve, reject){
    var client = redis.createClient();
    client.on('connect', function() {
    console.log('connected');
    client.get(req.cookies.auth_token, function(err, reply){
      client.end()
      if(err) 
      return reject(err)
      else
      resolve(reply)
    })
  });
  })
}
module.exports.insert_task_promise = function(username, formdata) {
  return new Promise(function(resolve, reject) {
    db_conn().query("insert into task (user, title, description, category, priority, assignee, attachment) values (?, ?, ?, ?, ?, ?, ?)", [username, formdata.title, formdata.description, formdata.category, formdata.priority, formdata.assignee, formdata.attachment], function(err, result, field){
      if(err)
        return reject(err)
      else
        resolve("1")
   })
  })
}

module.exports.edit_task_promise = function(username, formdata) {
  return new Promise(function(resolve, reject) {
    if(formdata.attachmennt != undefined) {
      db_conn().query("update task SET title = ?, description = ?, category = ? , priority = ?, assignee =? , attachment = ?, status = ? where id = ?", [ formdata.title, formdata.description, formdata.category, formdata.priority, formdata.assignee, formdata.attachment, parseInt(formdata.status), formdata.id], function(err, result, field){
        if(err)
         return reject(err)
        else
         resolve("1")
      })
   }
   else {
    db_conn().query("update task SET title = ?, description = ?, category = ? , priority = ?, assignee =?, status = ? where id = ?", [ formdata.title, formdata.description, formdata.category, formdata.priority, formdata.assignee, parseInt(formdata.status), formdata.id], function(err, result, field){
      if(err)
       return reject(err)
      else
       resolve("1")
    })
   }
  })
}

module.exports.get_tasks_promise = function(username) {
  return new Promise(function(resolve, reject) {
    db_conn().query("SELECT * from task where user = ? or assignee = ?", [username, username], function(err, results, field){
      if(err)
        return reject(err)
      else
        resolve(results)
    })
  })
}