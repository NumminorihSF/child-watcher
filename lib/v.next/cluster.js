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


var cpu = require('os').cpus().length;
function Cluster (childSettings, options){
    this.threads = new (require(__dirname+'/master.js'))();
    options = options || {};
    this.ceiling = Number(options.ceiling) || cpu*2;
    if (this.ceiling > cpu*2) this.ceiling = cpu*2;
    this.maxWorkDuration = options.maxWorkDuration || 20;
    this.minSpawnTimeout = options.minSpawnTimeout || 1000;
    this.canRun = true;
    this.runned = 0;

    childSettings = childSettings || {};
    childSettings.shouldRespawn = true;

    this.childSettings = childSettings;
    this.should_work = true;
    this.workers = [];
    return this;
}

Cluster.prototype.checkPool = function(){
    if (this.canRun) {
        var time = this.threads.getAveLoad();
        if (time > this.maxWorkDuration || this.runned === 0) {
            if (this.runned < this.ceiling) {
                var name = Math.random()+this.runned;
                this.workers.push(name);
                var child = this.threads.newChild(name, this.childSettings);
                child.on('error', function (err) {
                    console.error('Error in worker:', err);
                });
                child.on('close', function(code){
                    if (code) return console.error('Worker closed with code:', code);
                    console.log('Worker closed');
                    if (this.workers.indexOf(name) === -1) this.runned--;
                    else if (!this.should_work){
                        this.runned--;
                        if (!this.runned) {
                            if (this.callback) return this.callback();
                        }
                    }
                }.bind(this));
                this.runned++;
                this.canRun = false;
                setTimeout(function(){
                    this.canRun = true;
                }.bind(this), this.minSpawnTimeout);
            }
        }
        else if (this.runned > 1) {
            if (time*3 < this.maxWorkDuration) {
                name = this.workers.pop();
                this.threads.killChild(name);
            }
        }
    }

};


Cluster.prototype.ipc = function(json, callback){
    this.checkPool();
    if (this.should_work) {
        if (this.runned > 1) this.threads.ipcAny(json, callback);
        else this.threads.ipc(this.workers[0], json, callback);
    }
    else return callback(new Error('server is closing'));
};

Cluster.prototype.createClusterMaster = function(childSettings, opt){
    return new Cluster(childSettings, opt);
};

Cluster.prototype.close = function(callback){
    this.should_work = false;
    this.threads.close();
    this.callback = callback;
};



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
                load += Math.floor(((this.wait[i]|| 0)>>>3)*load);
                ave += load;
                this.weight.push({name: i, load: load});
            }
            this.averengeLoad = ave/(this.weight.length || 1);
            this.weight = this.weight.sort(function(a,b){
                return a.load - b.load;
            });
            //console.log(ave, this.averengeLoad, this.wait);
        }.bind(this);
        this.interval = setInterval(function(){getTimes()}, 1000);
        getTimes();
    }
    if (!this.weight.length) return callback(new Error('no workers'));
    var need = this.weight[0].name;
    this.weight.push(this.weight.shift());
    this.ipc(need, json, callback);
};

Master.prototype.ipcBroadcast = function(json, callback){
    var res = {errors: [], success:[]};
    var count = 0;
    var self = this;
    for(var i in this.spawned){
        count++;
        (function(id){
            setImmediate(function(){
                self.ipc(id, json, function(err, data){
                    if (err) res.errors.push({childName: id, error:err});
                    else res.success.push({childName: id, res: data});
                    if (--count === 0) return callback(res.errors.length===0?null:res.errors, res.success.length===0?undefined:res.success);
                });
            });
        })(i);
    }
};

Master.prototype.getChild = function(name){
    return this.spawned[name] || null;
};

Master.prototype.getAveLoad = function(){
    return this.averengeLoad;
};

Master.prototype.close = function(){
    for(var i in this.spawned){
        this.spawned[i].setShouldRespawn(false);
        this.spawned[i].kill('SIGTERM');
    }
};

Master.prototype.killChild = function(name){
    if (this.spawned[name]) this.spawned[name].kill('SIGTERM');
    delete this.spawned[name];
};


module.exports = Master;



module.exports = Cluster;

