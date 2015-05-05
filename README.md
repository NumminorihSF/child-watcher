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
This example run script 'child-watcher/lib/worker.js' and respawn it after close.

# Methods

## new Master(options)

`options` is an Object. May be `{}`. Contains properties:
* `.logger` - Logger object - to log inner events


## master.newChild(name, [options]) 

Create child process, and member it with `name` that should be unique. 

## master.on(name, eventName, callback)

Create listener on process with name. Listen event with eventName and spawn `callback(data)`

#TODO

other methods

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

 