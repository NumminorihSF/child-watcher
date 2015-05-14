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

if (module.parent){
    module.exports = {
        ClusterMaster: require(__dirname+'/lib/cluster.js'),
        Cluster: require(__dirname+'/lib/cluster.js'),
        Master: require(__dirname+'/lib/master.js'),
        Child: require(__dirname+'/lib/child.js'),
        next: {
            Cluster: require(__dirname+'/lib/v.next/cluster.js'),
            Master: require(__dirname+'/lib/v.next/master.js'),
            Child: require(__dirname+'/lib/v.next/child.js')
        }
    }
}
else {
    var master = new (require(__dirname+'/lib/v.next/master.js'))();

    master.newChild('first');
    master.newChild('second',{shouldRespawn: true});
    master.getChild('second').on('spawned', function(data){
        console.log('SPAWNED');
    });

    master.on('close', function(data){
        console.log(data.childName+' closed with code', data);
    });

    master.ipc('first', {parameters: 1}, function(err, data){
        console.log('f1',err, data);
    });
    master.ipc('second', {parameters: 1}, function(err, data){
        console.log('s1',err, data);
    });
    master.ipc('second', {parameters: 2}, function(err, data){
        console.log('s2',err, data);
    });
    master.send('first', 'some string to send', function(err, data){
        console.log('f2', err, data);
    });
    master.sendJSON('first', {some: 'json'}, function(err, data){
        console.log('f3', err, data);
    });
    master.on('error', function(err){
        console.error(err);
    });

}