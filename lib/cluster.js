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
function ClusterMaster (childSettings, options){
    this.threads = new (require(__dirname+'/master.js'))();
    options = options || {};
    this.ceiling = Number(options.ceiling) || cpu*2;
    if (this.ceiling > cpu*2) this.ceiling = cpu*2;
    this.maxWorkDuration = options.maxWorkDuration || 20;
    this.minSpawnTimeout = options.minSpawnTimeout || 1000;
    this.canRun = true;
    this.runned = 0;
    childSettings.shouldRespawn = true;
    this.childSettings = childSettings;
    this.should_work = true;
    this.workers = [];
    return this;
}

ClusterMaster.prototype.checkPool = function(){
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


ClusterMaster.prototype.ipc = function(json, callback){
    this.checkPool();
    if (this.should_work) {
        if (this.runned > 1) this.threads.ipcAny(json, callback);
        else this.threads.ipc(this.workers[0], json, callback);
    }
    else return callback(new Error('server is closing'));
};

ClusterMaster.prototype.createClusterMaster = function(childSettings, opt){
    return new ClusterMaster(childSettings, opt);
};

ClusterMaster.prototype.close = function(callback){
    this.should_work = false;
    this.threads.close();
    this.callback = callback;
};

module.exports = ClusterMaster;

