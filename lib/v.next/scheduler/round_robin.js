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

"use strict";

var cpu = require('os').cpus().length;

function RoundRobin (options){
    RoundRobin.super_.call(this);
    options = options || {};
    this.processMax = Number(options.processMax) || cpu*2;
    if (isNaN(options.processMin)) this.processMin = 1;
    else this.processMin = Math.floor(Number(options.processMin));
    if (this.processMin < 0) this.processMin = 1;

    this.maxWorkDuration = options.maxWorkDuration || 50;
    this.minSpawnTimeout = options.minSpawnTimeout || 1000;
    this.idleTimeout = options.idleTimeout || 60000;

    if (options.calcInterval === null) this.calcInterval = 0;
    else this.calcInterval = Number(options.calcInterval) || 100;
    this.calcIntervalObject = null;

    this.canRunNew = true;

    this.lastUsed = 0;

    this.lastCreated = 0;

    this.workersInfo = {};

    this.workersIdleTimeouts = {};

    this.averengeLoad = 0;

    this.workersQueue = [];

    this.runned = 0;
    this.waitRun = 0;
    this.idle = false;

    var self = this;

    this.on('addWorker', function(id){
        self.runned++;
        self.waitRun--;
        self.workersInfo[id] = {load: 0, task: 0};
        self.workersIdleTimeouts[id] = setTimeout(function(){
            self.emit('idleTimeout', id);
        }, self.idleTimeout);
    });

    this.on('removeWorker', function(id){
        delete self.workersInfo[id];
        delete self.workersIdleTimeouts[id];
        for(var i = 0; i < self.workersQueue.length; i++){
            if (self.workersQueue[i].id == id) self.workersQueue.splice(i, 1);
        }
    });

    this.on('startTask', function(workerId){
        "use strict";

        if (self.workersInfo[workerId]){
            var worker = self.workersInfo[workerId];
            worker.task++;
            clearTimeout(self.workersIdleTimeouts[workerId]);
        }
    });

    this.on('endTask', function(task){
        "use strict";

        if (('name' in task) && !('wid' in task)) task.wid = task.name;
        if (!('wid' in task)) return;
        if (self.workersInfo[task.wid]){
            var worker = self.workersInfo[task.wid];
            if (task.id%10 === 0) worker.load = (worker.load*63 + task.time)>>>6;
            if (--worker.task === 0) self.workersIdleTimeouts[task.wid] = setTimeout(function(){
                self.emit('idleTimeout', task.wid);
            }, self.idleTimeout);
        }
    });

    (function(){
        "use strict";

        var wait = false;

        self.on('idleTimeout', function(workerId){
            if (wait === false) {
                self.idle = String(workerId);
                self.wait = true;
                var timeout = self.idleTimeout*2;
                setTimeout(function(){
                    self.wait = false;
                }, timeout);
            }
        });
    })();

    return this;
}

(function(){
    require('util').inherits(RoundRobin, (require('events')).EventEmitter);
})();



RoundRobin.prototype.getLoad = function(){
    "use strict";
    if (this.calcIntervalObject) return this.averengeLoad;

    var self = this;
    var getLoad = function () {
        var ave = 0;
        for (var i in self.workersInfo) {
            var load = self.workersInfo[i].load;
            load += Math.floor(((self.workersInfo[i].task || 0) >>> 3) * load);
            ave += load;
            self.workersQueue.push({id: i, load: load});
        }
        self.averengeLoad = ave / (self.workersQueue.length || 1);
        self.lastUsed = 0;
    };
    if (this.calcInterval === 0) getLoad();
    else {
        this.calcIntervalObject = setInterval(function () {
            getLoad();
        }, self.calcInterval);
    }

};

RoundRobin.prototype.checkPool = function(){
    "use strict";

    if (this.runned < this.processMin) {
        if (this.waitRun === 0) for(var i = this.processMin - this.runned; i > 0; i--){
            this.waitRun++;
            this.emit('createWorker', ++this.lastCreated);
        }
        return;
    }


    if (this.canRunNew) {
        var time = this.getLoad();

        if (time > this.maxWorkDuration) {
            if (this.waitRun === 0) if (this.runned < this.processMax) {
                this.waitRun++;
                this.emit('createWorker', ++this.lastCreated);
                this.canRunNew = false;
                setTimeout(function(){
                    this.canRunNew = true;
                }.bind(this), this.minSpawnTimeout);
            }
        }
        else if (this.runned > this.processMin) {
            if (this.idle) {
                this.emit('removeWorker', this.idle);
                this.idle = false;
            }
            else if (time * 3 < this.maxWorkDuration) {
                var id = this.workersQueue[this.workersQueue.length-1].id;
                this.emit('removeWorker', id);
            }
        }
    }
};

RoundRobin.prototype.getNextArrIndex = function(){
    var i = this.lastUsed++;
    if (i >= this.workersQueue.length) {
        this.lastUsed = 0;
        return 0;
    }
    return i;
};

RoundRobin.prototype.getWorkerName = function(callback){
    this.checkPool();
    if (this.workersQueue.length) {
        var index = this.getNextArrIndex();
        var id = this.workersQueue[index].id;
        return callback(null, id);
    }
    else {
        var self = this;
        setTimeout(function(){
            if (self.workersQueue.length) {
                var index = self.getNextArrIndex();
                var id = self.workersQueue[index].id;
                return callback(null, id);
            }
            return callback(new Error('EMPTY_WORKERS_PULL'));
        }, this.minSpawnTimeout);
    }
};


module.exports = RoundRobin;

