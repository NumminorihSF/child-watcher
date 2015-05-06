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
    this.runned = 0;
    childSettings.shouldRespawn = true;
    this.childSettings = childSettings;
    this.should_work = true;
    return this;
}

ClusterMaster.prototype.startWorker = function(){
    if (this.runned < this.ceiling && this.threads.getAveLoad() > this.spawnWorkerTimeout || this.runned === 0) {
        var child = this.threads.newChild(this.runned, this.childSettings);
        child.on('error', function (err) {
            console.error('Error in worker:', err);
        });
        child.on('close', function(code){
            if (code) return console.error('Worker closed with code:', code);
            console.log('Worker closed');
            if (!this.should_work){
                this.runned--;
                if (!this.runned) {
                    if (this.callback) return this.callback();
                }
            }
        }.bind(this));
        var old = this.runned;
        this.runned = this.ceiling*2;
        var wait = this.minSpawnTimeout;
        setTimeout(function(){
            this.runned = old+1;
        }.bind(this), wait);
    }
};


ClusterMaster.prototype.ipc = function(json, callback){
    this.startWorker();
    if (this.should_work) {
        if (this.runned > 1) this.threads.ipcAny(json, callback);
        else this.threads.ipc(0, json, callback);
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

