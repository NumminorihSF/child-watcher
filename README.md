child-watcher
===========================

Lib for running some child process, send info to id and parse answer. Use stdio.

Install with:

    npm install child-watcher


# Usage

Simple example:

```js

    var master = new (require('child-watcher').Master)();
   
        master.newChild('second',{shouldRespawn: true});
        master.on('second', 'close', function(data){
            console.log('second closed with code %d, respawn', data);
        });
        master.ipc('second', {parameters: 1}, function(err, data){
            console.log('s1',err, data);
        });
        master.on('second', 'error', function(err){
            console.error(err);
        });
        
```
This example run script 'child-watcher/lib/example_worker.js' and respawn it after close.

# Methods

## new Master(options)

`options` is an Object. May be `{}`. Contains properties:
* `.logger` - Logger object - to log inner events


## master.newChild(name, [options]) 

Create child process, and member it with `name` that should be unique. 

* `name` - String. Unique name of child
* `options` - Object. options for child manager constructor (see below). Defailt `{}`
* `options.logger` Logger object
* `options.filePath` - String. Path to worker's file. Default `__dirname+'/example_worker.js'` (lib/example_worker.js)
* `options.env` - Object. Environment for child process. Default `process.env`
* `options.shouldRespawn` Boolean. `true`, if need respawn, else `false` or `undefined`. Default `false`
* `options.command` String. Command to run
* `options.arguments` String[]. Arguments for command (without filePath for nodejs)

Example:
`master.newChild('first');`

Returns ChildManager object. If Child with such name already exist, doesn't create and just return it.



## master.on(name, eventName, callback)

Create listener on process with name. Listen event with eventName and spawn `callback(data)`

Example:
```js
    //emit then process close. data is close code
    master.on('first', 'close', function(data){
        console.log('first closed with code', data);
    });
    //emit then child send something to stdout, that ends with '\r\n' if cat JSON.parse - emit result of parse, else emit string
    master.on('first', 'data', function(data){
        console.log('first emit some data', data);
    });
    //then child send something to stderr, emit this. without 'error' emitter - process will end with error
    master.on('first', 'error', function(err){
        console.error(err);
    });
```

If child process should not respawn, listener will removed after process exit.
The description of events see below at ChildManager.

## master.getChild(name)

Returns ChildManager object, if Child with such name exists. If no such child - returns null.

## master.send(name, message, callback)

Send message to stdin of child with name.

## master.sendJSON(name, object, callback)

Send object (stringified) to stdin of child with name.

## master.ipc(name, ipcParams, callback)

An ipc call of some function on child with name. How child should work with it - see below.
Callback called with (error, result). If no answer in 60 second - will return Error `TIMEOUT`

## master.ipcAny(ipcParams, callback)

An ipc call of some function on child with smallest time of answers. How child should work with it - see below.
Callback called with (error, result). If no answer in 60 second - will return Error `TIMEOUT`


# ChildManager

An object, that master returns.

```js
    var childMan = master.getChild('first');
```

## new ChildManager(options)

A constructor of CM.

* `options` - Object. options for child process. Defailt `{}`
* `options.logger` Logger object
* `options.filePath` - String. Path to worker's file. Default `__dirname+'/example_worker.js'` (lib/example_worker.js)
* `options.env` - Object. Environment for child process. Default `process.env`
* `options.shouldRespawn` Boolean. `true`, if need respawn, else `false` or `undefined`. Default `false`
* `options.command` String. Command to run. Default `node`
* `options.arguments` String[]. Arguments for command (without filePath for nodejs). Default `[]`

## childMan.spawn()

Spawn child process. Called automaticaly, then create childManager object.
If command is `'node'` or `'nodejs'` or `'iojs'` - spawn Child object, that will do `require(options.filePath)(setWorkerFunction)`

## setWorkerFunction (IPC)

In worker you should define some function that will emit data from master process, and decide that it will do.

Example of worker:
```js

    var worker = new (require('events')).EventEmitter();
    worker.on('ipc', function(ipc){
        //ipc.id - id for master to spawn callback
        //ipc.params - parameters, that sended to worker
        //ipc.callback - callback function. First argument is error, second is data
    
        if (ipc.id == 1) return ipc.callback(new Error('some error for first ipc'));
        else return ipc.callback(null, 'everithyng is ok. Params: '+JSON.stringify(ipc.params));
    });
    worker.on('json', function(json){
        //do something with json
    });
    
    worker.on('string', function(string){
        //do something with string
    });
    
    worker.on('data', function(someData){
        //do something with any data (ipc, json of string)
    });
    
    module.exports = function(setWorker){
        setWorker(worker);
    };
```

## childMan.send(message, callback)

Send message to stdin of child.

## childMan.sendJSON(object, callback)

Send object (stringified) to stdin of child.

## childMan.ipc(ipcParams, callback)

An ipc call of some function on child.
Callback called with (error, result). If no answer in 60 second - will return Error `TIMEOUT`

## childMan.kill(signal)

Sends kill signal to child process and stop auto-respawning

## childMan.setShouldRespawn(booleanVal)

If you don't want to auto-respawn child process, use `childMan.setShouldRespawn(false)`.
If you want to auto-respawn it - use  `childMan.setShouldRespawn(true)`.


# ClusterMaster

## new ClusterMaster(workerOptions[, masterOptions])

The constructor of cluster. If you need many copies of some worker - you can use this.
```js

    var cmaster = new (require('child-watcher').ClusterMaster)({filePath: 'worker.js'}, {});
```
It runs 1 worker. `workerOptions` is some like `childMan` options.

`masterOptions` is an object. Include: 

* `.ceiling` - number. Count of max workers processes. Can't be more than cpus*2. Default `cpus*2`.
* `.maxWorkDuration` - number (ms). 
How long worker can do task. If duration of tasks is bigger - will try to spawn one more worker. 
Also, if `durationOfWork*3<maxWorkDuration` and more than 1 worker - try close one worker (by send `SIGTERM`). 
Default `20`.
* `.minSpawnTimeout` - number (ms). How often can spawn workers. Default `1000` ms. 


## cmaster.ipc(ipcParams, callback)

An ipc call of some function on child. Task will be emitted by most free worker.
Callback called with (error, result). If no answer in 60 second - will return Error `TIMEOUT`



# LICENSE - "MIT License"

Copyright (c) 2015 Konstantine Petryaev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

 