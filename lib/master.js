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
var defaultLogger = {
    trace: function(){console.log('TRACE\t'+ Array.prototype.join.call(arguments, ' '));},
    debug: function(){console.log('DEBUG\t'+ Array.prototype.join.call(arguments, ' '));},
    info: function(){console.log('INFO\t'+ Array.prototype.join.call(arguments, ' '));},
    warn: function(){console.error('WARN\t'+ Array.prototype.join.call(arguments, ' '));},
    error: function(){console.error('ERROR\t'+ Array.prototype.join.call(arguments, ' '));},
    fatal: function(){console.error('FATAL\t'+ Array.prototype.join.call(arguments, ' '));}
};


function Master(options){
    this.logger = options.logger || defaultLogger;
    this.spawned = {};


    return this;
}


Master.prototype.spawn = function(name, filePath, options){
    if (typeof filePath === 'Object') {
        options = filePath;
        filePath = false;
    }
    if (!filePath) {
        filePath = name;
        name += '('+Math.floor(Math.random()*1000)+')';
    }

    if (this.spawned[name]) return name;
    options = options || {};
    options.env = options.env || process.env;
    options.stdio = ['pipe', 'pipe', 'pipe'];

    this.spawned[name] = cp.spawn("node "+filePath, options);

    var respawn = function(code){
        this.spawned[name].removeAllListener('close');
        if (code) this.logger.error('Process "'+name+'" closed with code:'+ code);
        else this.logger.error('Process "'+name+'" closed with code:'+ code);
        delete this.spawned[name];
        setTimeout(function(){this.spawn(name, filePath, options);}.bind(this), 100);
    }.bind(this);

    this.spawned[name].on('close', respawn);
    this.spawned[name].on('stopRespawning', function(){
        this.spawned[name].removeListener('close', respawn);
    }.bind(this));
    this.spawned[name].on('startRespawning', function(){
        this.spawned[name].removeListener('close', respawn);
        this.spawned[name].on('close', respawn);
    }.bind(this));
};

Master.prototype.spawnOnce = function(name, filePath, options){
    if (typeof filePath === 'Object') {
        options = filePath;
        filePath = false;
    }
    if (!filePath) {
        filePath = name;
        name += '('+Math.floor(Math.random()*1000)+')';
    }

    if (this.spawned[name]) return name;
    options = options || {};
    options.env = options.env || process.env;
    options.stdio = ['pipe', 'pipe', 'pipe'];

    this.spawned[name] = cp.spawn("node "+filePath, options);

    var respawn = function(code){
        this.spawned[name].removeAllListener('close');
        if (code) this.logger.error('Process "'+name+'" closed with code:'+ code);
        else this.logger.error('Process "'+name+'" closed with code:'+ code);
        delete this.spawned[name];
        setTimeout(function(){this.spawn(name, filePath, options);}.bind(this), 100);
    }.bind(this);

    this.spawned[name].on('stopRespawning', function(){
        this.spawned[name].removeListener('close', respawn);
    }.bind(this));
    this.spawned[name].on('startRespawning', function(){
        this.spawned[name].removeListener('close', respawn);
        this.spawned[name].on('close', respawn);
    }.bind(this));
};

Master.prototype.startRespawn = function(name){
    if (!this.spawned[name]) return null;
    this.spawned[name].emit('startRespawning');
    return name;
};

Master.prototype.stopRespawn = function(name){
    if (!this.spawned[name]) return null;
    this.spawned[name].emit('stopRespawning');
    return name;
};

