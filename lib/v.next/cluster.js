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


function Cluster (options, childSettings){
    Cluster.super_.call(this, options, childSettings);

    this.childSettings.shouldRespawn = true;

    this.scheduler = new (require(__dirname+'/scheduler'))[(options.scheduler || 'LoadFree')](options);

    var self = this;

    this.scheduler.on('createWorker', function(id){
        self.newChild(id, self.childSettings);
        self.getChild(id).once('spawned', function(){
            self.scheduler.emit('addWorker', id);
        });
        self.getChild(id).once('close', function(){
            self.emit('close', {id:id});
        });
    });

    this.on('close', function(o){
        self.scheduler.emit('removeWorker', o.id);
    });

    this.scheduler.on('removeWorker', function(id){
        self.killChild(id);
    });

    this.on('startTask', function(task){
        self.scheduler.emit('startTask', task);
    });

    this.on('endTask', function(task){
        self.scheduler.emit('endTask', task);
    });

    this.should_work = true;
    return this;
}

(function(){
    require('util').inherits(Cluster, (require(__dirname+'/master.js')));
})();




//Cluster.prototype.checkPool = function(){
//    if (this.canRun) {
//        var time = this.threads.getAveLoad();
//        if (time > this.maxWorkDuration || this.runned === 0) {
//            if (this.runned < this.ceiling) {
//                var name = Math.random()+this.runned;
//                this.workers.push(name);
//                var child = this.threads.newChild(name, this.childSettings);
//                child.on('error', function (err) {
//                    console.error('Error in worker:', err);
//                });
//                child.on('close', function(code){
//                    if (code) return console.error('Worker closed with code:', code);
//                    console.log('Worker closed');
//                    if (this.workers.indexOf(name) === -1) this.runned--;
//                    else if (!this.should_work){
//                        this.runned--;
//                        if (!this.runned) {
//                            if (this.callback) return this.callback();
//                        }
//                    }
//                }.bind(this));
//                this.runned++;
//                this.canRun = false;
//                setTimeout(function(){
//                    this.canRun = true;
//                }.bind(this), this.minSpawnTimeout);
//            }
//        }
//        else if (this.runned > 1) {
//            if (time*3 < this.maxWorkDuration) {
//                name = this.workers.pop();
//                this.threads.killChild(name);
//            }
//        }
//    }
//
//};


Cluster.prototype.ipc = function(json, callback){
    var self = this;
    if (this.should_work) this.scheduler.getWorkerName(function(err, id){
        if (err) return callback(err);
        var time = new Date().getTime();
        var task = {wid: id};
        self.emit('startTask', task);
        self.spawned[id].ipc(json, function(err, data){
            task.time = new Date().getTime() - time;
            self.emit('endTask', task);
            return callback(err, data);
        });
    });
    else return callback(new Error('server is closing'));
};

//Cluster.prototype.close = function(){
//    this.should_work = false;
//    this.super_.killAll();
//    this.callback = callback;
//};
//
//Cluster.prototype.killAll = Cluster.prototype.close;

Cluster.prototype.createCluster = function(opt, childSettings){
    return new Cluster(opt, childSettings);
};

Cluster.prototype.createClusterMaster = Cluster.prototype.createCluster;

module.exports = Cluster;

