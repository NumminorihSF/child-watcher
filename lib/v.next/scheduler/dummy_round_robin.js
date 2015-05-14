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

function DummyRoundRobin (options){
    DummyRoundRobin.super_.call(this);
    options = options || {};
    this.processMax = options.processMax || cpu*2;
    this.lastUsed = 0;
    this.workersQueue = [];
    this.runned = 0;
    this.waitRun = 0;
    var self = this;

    this.on('addWorker', function(id){
        self.runned++;
        self.waitRun--;
        self.workersQueue.push({id: id});
    });

    this.on('removeWorker', function(id){
        for(var i = 0; i < self.workersQueue.length; i++){
            if (self.workersQueue[i].id == id) self.workersQueue.splice(i, 1);
        }
        self.emit('addWorker', id);
    });

    return this;
}

(function(){
    require('util').inherits(DummyRoundRobin, (require('events')).EventEmitter);
})();


DummyRoundRobin.prototype.checkPool = function(){
    "use strict";

    if (this.runned < this.processMax) {
        if (this.waitRun === 0) for(var i = this.processMax - this.runned; i > 0; i--){
            this.waitRun++;
            this.emit('createWorker', ++this.lastCreated);
        }
    }
};

DummyRoundRobin.prototype.getNextArrIndex = function(){
    var i = this.lastUsed++;
    if (i >= this.workersQueue.length) {
        this.lastUsed = 0;
        return 0;
    }
    return i;
};

DummyRoundRobin.prototype.getWorkerName = function(callback){
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


module.exports = DummyRoundRobin;

