/**
 * Created by numminorihsf on 29.04.15.
 */

var cp = require('child_process');
var spawn = cp.spawn;
var fs = require('fs');
//var memwatch = require('./node-memwatch');
//memwatch.on('leak', function(info) {
//    console.error('leak', info);
//});
//memwatch.on('stats', function(stats) {
//    console.error('start', stats);
//});

var defaultLogger = {
    trace: function(){console.log('TRACE\t'+ Array.prototype.join.call(arguments, ' '));},
    debug: function(){console.log('DEBUG\t'+ Array.prototype.join.call(arguments, ' '));},
    info: function(){console.log('INFO\t'+ Array.prototype.join.call(arguments, ' '));},
    warn: function(){console.error('WARN\t'+ Array.prototype.join.call(arguments, ' '));},
    error: function(){console.error('ERROR\t'+ Array.prototype.join.call(arguments, ' '));},
    fatal: function(){console.error('FATAL\t'+ Array.prototype.join.call(arguments, ' '));}
};

function ChildManager (options){
    console.log('CONSTRUCTOR');
    ChildManager.super_.call(this);

    options = options || {};
    this.logger = options.logger || defaultLogger;
    options.filePath = options.filePath || 'worker.js';
    options.env = options.env || process.env;

    if (typeof options.shouldRespawn === 'undefined') this.shouldRespawn = true;
    else this.shouldRespawn = Boolean(options.shouldRespawn);

    this.callbacks = {};
    this.lastId = 1;
    this.tail = '';



    this.on('close', function(){
        //this.process.stdout && this.process.stdout.removeAllListeners();
        //this.process.removeAllListeners();
        if (typeof gc !== 'undefined') gc();
        setTimeout(function() {
            delete this.process;
            for (var i in this.callbacks) {
                this.callbacks[i](Error('PROCESSCLOSE'));
            }
            if (this.shouldRespawn) this.spawn();
        }.bind(this), 10);
    }.bind(this));
    this.spawnOptions = {arguments: options.arguments, filePath: options.filePath, stdio: ['pipe', 'pipe', process.err, 'ipc'], end: process.env};
    this.spawn();

    return this;
}

(function(){
    require('util').inherits(ChildManager, (require('events')).EventEmitter);
})();


ChildManager.prototype.spawn = function(){
    console.log('SPAWN');
    this.shouldRespawn = true;
    if (this.process) return;

    var command = this.spawnOptions.command || 'node';
    if (this.spawnOptions.arguments) {
        var args = this.spawnOptions.arguments.split(' ');
        args.push(this.spawnOptions.filePath);
    }
    else args = [this.spawnOptions.filePath];

    this.process = spawn(command, args);
    this.process.on('close', function(code){
        this.process.stdin.unpipe();
        this.process.stdout.unpipe();
        this.process.stderr.unpipe();
        this.emit('close', code);
    }.bind(this));
    this.tail = '';
    this.process.stdout.setEncoding('utf-8');
    this.process.stdout.on('data', function(data){
        this.parseStdOut(data);
    }.bind(this));
};

ChildManager.prototype.kill = function(signal){
    this.shouldRespawn = false;
    this.process.kill(signal);
};

ChildManager.prototype.setShouldRespawn = function(should){
    this.shouldRespawn = Boolean(should);
};

ChildManager.prototype.ipc = function(ipcParams, callback){
    console.log('IPC');
    var id = this.lastId++;
    this.callbacks[id] = function(err, data){
        clearTimeout(timeout);
        delete this.callbacks[id];
        callback(err, data);
    }.bind(this);

    var timeout = setTimeout(function(){
        this.callbacks[id](Error('TIMEOUT'));
    }.bind(this), 60000);
    this.send(JSON.stringify({ipc: ipcParams})+'\r\n');
};

ChildManager.prototype.send = function(message, count){
    console.log('SEND');
    count = ++count || 1;
    var self = this;
    if (count > 30) return self.logger.error('Can not send.', message);
    var timeout = count*100;
    setTimeout(function(){
        self.send(message, count);
    }, timeout)
};

ChildManager.prototype.parse = function(data){
    console.log('PARSE');
    try{
        data = JSON.parse(data);
    }
    catch(e){
        return null;
    }
    return data;
};

ChildManager.prototype.parseStdOut = function(data){
    console.log('PARSESTD');
    this.tail += data.replace(/\r\n[\r\n]+/g, '\r\n');
    var array = this.tail.split('\r\n');
    if (array.length && !array.pop().length) {
        this.tail = '';
        var answers = [];
        for (var i = 0; i < array.length; i++){
            var answer = this.parse(array[i]);
            if (answer === null) continue;
            answers.push(answer);
        }
        setImmediate(function(){
            for(var i = 0; i < answers.length; i++){
                if (this.callbacks[answers[i].id]) this.callbacks[answers[i].id](answers[i].error, answers[i].data);
                else {
                    this.emit('data', answers[i]);
                }
            }
        }.bind(this));
    }
};

var a = new ChildManager();
var b = new ChildManager();
var c = new ChildManager();
var d = new ChildManager();
var e = new ChildManager();
var last = process.memoryUsage().rss;
setInterval(function(){
    var current = process.memoryUsage().rss;
    if (last !== current) {
        console.error(new Date()+'\t'+ current/1024 + '\t',current - last);
        last = current;
    }
},1000);
