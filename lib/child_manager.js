/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 (NumminorihSF) Konstantine Petryaev
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


var cp = require('child_process');
var spawn = cp.spawn;

var defaultLogger = {
    trace: function(){console.log('TRACE\t'+ Array.prototype.join.call(arguments, ' '));},
    debug: function(){console.log('DEBUG\t'+ Array.prototype.join.call(arguments, ' '));},
    info: function(){console.log('INFO\t'+ Array.prototype.join.call(arguments, ' '));},
    warn: function(){console.error('WARN\t'+ Array.prototype.join.call(arguments, ' '));},
    error: function(){console.error('ERROR\t'+ Array.prototype.join.call(arguments, ' '));},
    fatal: function(){console.error('FATAL\t'+ Array.prototype.join.call(arguments, ' '));}
};

function ChildManager (options){
    ChildManager.super_.call(this);

    options = options || {};
    this.logger = options.logger || defaultLogger;
    options.filePath = options.filePath || __dirname+'/example_worker.js';
    options.env = options.env || process.env;

    this.shouldRespawn = Boolean(options.shouldRespawn);

    this.callbacks = {};
    this.lastId = 1;
    this.tail = '';
    this.averangeTimeout = 25;

    this.on('close', function(){
        if (typeof gc !== 'undefined') gc();
        setTimeout(function() {
            delete this.process;
            for (var i in this.callbacks) {
                this.callbacks[i](new Error('PROCESSCLOSE'));
            }
            if (this.shouldRespawn) this.spawn();
        }.bind(this), 10);
    }.bind(this));
    this.spawnOptions = {command: options.command, arguments: options.arguments, filePath: options.filePath, stdio: ['pipe', 'pipe', 'pipe', 'ipc'], env: options.env};
    this.spawn();

    return this;
}

(function(){
    require('util').inherits(ChildManager, (require('events')).EventEmitter);
})();


ChildManager.prototype.spawn = function(){
    if (this.process) return;

    var command = this.spawnOptions.command || 'node';
    if (this.spawnOptions.arguments) {
        var args = this.spawnOptions.arguments.split(' ');
        args.push(this.spawnOptions.filePath);
    }
    else args = [this.spawnOptions.filePath];
    if (command === 'node' || command === 'nodejs' || command === 'iojs') {
        this.spawnOptions.env.NODE_RUN = args[args.length-1];
        args[args.length-1] = __dirname+'/child.js';
    }
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
    this.process.stderr.setEncoding('utf-8');
    this.process.stderr.on('data',function(d){
        try{
            d= JSON.parse(d);
        }
        catch(e){}
        if (d) this.emit('error', new Error('ONCHILDERR'+d))
    }.bind(this));

    return this;
};


ChildManager.prototype.kill = function(signal){
    this.shouldRespawn = false;
    this.process.kill(signal);
};

ChildManager.prototype.setShouldRespawn = function(should){
    this.shouldRespawn = Boolean(should);
};

ChildManager.prototype.ipc = function(ipcParams, callback){
    var id = this.lastId++;
    var time = new Date().getTime();
    this.callbacks[id] = function(err, data){
        if (id%10 === 0) this.averangeTimeout = (this.averangeTimeout*63 + new Date().getTime() - time)/64;
        clearTimeout(timeout);
        delete this.callbacks[id];
        callback(err, data);
    }.bind(this);

    var timeout = setTimeout(function(){
        if (this.callbacks[id]) this.callbacks[id](new Error('TIMEOUT'));
    }.bind(this), 60000);
    this.send(JSON.stringify({ipc: true, params:ipcParams, id: id})+'\r\n', this.callbacks[id]);
};

ChildManager.prototype.send = function(message, callback){
    if (this.process && this.process.stdin && this.process.stdin.write) this.process.stdin.write(message+'\r\n', function(err, data){
        if (err) return callback(err);
    });
    else setTimeout(function(){
        if (this.process && this.process.stdin && this.process.stdin.write) this.process.stdin.write(message+'\r\n', function(err, data){
            if (err) return callback(err);
        });
        else return callback(new Error('NO_STREAM_TO_SEND'));
    }.bind(this),1000);
};

ChildManager.prototype.sendJSON = function(json, callback){
    var string = JSON.stringify(json);
    this.send(string, callback);
};

ChildManager.prototype.parse = function(data){
    try{
        data = JSON.parse(data);
    }
    catch(e){
        return null;
    }
    return data;
};

ChildManager.prototype.parseStdOut = function(data){
    this.tail += data.replace(/\r\n[\r\n]+/g, '\r\n');
    var array = this.tail.split('\r\n');
    this.tail = array.pop();
    if (array.length) {

        var answers = [];
        var stringAnswers = [];
        for (var i = 0; i < array.length; i++){
            var answer = this.parse(array[i]);
            if (answer === null) stringAnswers.push(array[i]);
            else answers.push(answer);
        }
        setImmediate(function(){
            for(var i = 0; i < answers.length; i++){
                if (answers[i].id) {
                    if (this.callbacks[answers[i].id]) this.callbacks[answers[i].id](answers[i].error, answers[i].data);
                }
                this.emit('json', answers[i]);
                this.emit('data', answers[i]);
            }
            for(i=0; i<stringAnswers.length; i++){
                this.emit('string', stringAnswers[i]);
                this.emit('data', stringAnswers[i]);
            }
        }.bind(this));
    }
};

ChildManager.prototype.getLoad = function(){
    return this.averangeTimeout;
};

module.exports = ChildManager;
