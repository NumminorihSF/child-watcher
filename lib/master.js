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


var Child = require('./child_manager');
var defaultLogger = {
    trace: function(){console.log('TRACE\t'+ Array.prototype.join.call(arguments, ' '));},
    debug: function(){console.log('DEBUG\t'+ Array.prototype.join.call(arguments, ' '));},
    info: function(){console.log('INFO\t'+ Array.prototype.join.call(arguments, ' '));},
    warn: function(){console.error('WARN\t'+ Array.prototype.join.call(arguments, ' '));},
    error: function(){console.error('ERROR\t'+ Array.prototype.join.call(arguments, ' '));},
    fatal: function(){console.error('FATAL\t'+ Array.prototype.join.call(arguments, ' '));}
};


function Master(options){
    options = options || {};
    this.logger = options.logger || defaultLogger;
    this.spawned = {};
    this.interval = null;
    this.weight = [];
    this.wait = {};
    this.averengeLoad = 100;
    return this;
}

Master.prototype.newChild = function(name, settings){
    if (this.spawned[name]) return this.spawned[name];
    if (!settings) settings = {};
    this.spawned[name] = new Child(settings);
    if (!settings.shouldRespawn) this.spawned[name].on('close',function(){
        delete this.wait[name];
        delete this.spawned[name];

    }.bind(this));
    return this.spawned[name];
};

Master.prototype.on = function(name, eventName, callback){
    if (!this.spawned[name]) return callback(new Error('no such children'));
    this.spawned[name].on(eventName, callback);
};

Master.prototype.send = function(name, string, callback){
    if (!this.spawned[name]) return callback(new Error('no such children'));
    this.spawned[name].send(string, callback);
};

Master.prototype.sendJSON = function(name, json, callback){
    if (!this.spawned[name]) return callback(new Error('no such children'));
    this.spawned[name].sendJSON(json, callback);
};

Master.prototype.ipc = function(name, json, callback){
    if (!this.spawned[name]) return callback(new Error('no such children'));
    this.wait[name] = this.wait[name]+1 || 1;
    this.spawned[name].ipc(json, function(err, data){
        this.wait[name]--;
        callback(err, data);
    }.bind(this));
};

Master.prototype.ipcAny = function(json, callback){
    if (!this.interval) {
        var getTimes = function(){
            this.weight = [];
            var ave = 0;
            for (var i in this.spawned){
                var load = this.spawned[i].getLoad();
                this.ave += load;
                this.weight.push({name: i, load: load+(this.wait[i]||0)*this.averengeLoad});
            }
            this.averengeLoad = ave/(this.weight.length || 1);
            this.weight.sort(function(a,b){
                return a.load - b.load;
            });
        }.bind(this);
        this.interval = setInterval(function(){getTimes()}, 1000);
        getTimes();
    }
    if (!this.weight.length) return callback(new Error('no workers'));
    var need = this.weight[0].name;
    this.weight.push(this.weight.shift());
    this.ipc(need, json, callback);
};

Master.prototype.getChild = function(name){
    return this.spawned[name] || null;
};



module.exports = Master;