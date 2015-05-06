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


var tail = '';
var parse = function(string){
    try{
        var res = JSON.parse(string)
    }
    catch(e){
        return null;
    }
    return res;
};
var w;
if (process.stdin){
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', function(data){
        tail += data.replace(/\r\n[\r\n]+/g, '\r\n');
        var array = tail.split('\r\n');
        tail = array.pop();
        if (array.length) {

            var answers = [];
            var stringAnswers = [];
            for (var i = 0; i < array.length; i++){
                var answer = parse(array[i]);
                if (answer === null) stringAnswers.push(array[i]);
                else answers.push(answer);
            }
            for(i = 0; i < answers.length; i++){
                (function(json){
                    if (w) {
                        w.emit('data', json);
                        if ('ipc' in json) {
                            json.callback = function(err, res){
                                process.stdout.write(JSON.stringify({id: json.id, error:err&&err.message, data:res})+'\r\n');
                            };
                            w.emit('ipc', json);
                        }
                        else w.emit('json', json);
                    }
                    else setTimeout(function(){
                        if (w) {
                            w.emit('data', json);
                            if ('ipc' in json) {
                                json.callback = function(err, res){
                                    process.stdout.write(JSON.stringify({id: json.id, error:err&&err.message, data:res})+'\r\n');
                                };
                                w.emit('ipc', json);
                            }
                            else w.emit('json', json);
                        }
                    }, 500);
                })(answers[i]);
            }

            for(i = 0; i < stringAnswers.length; i++){
                (function(string){
                    if (w) {
                        w.emit('data', string);
                        w.emit('string', string);
                    }
                    else setTimeout(function(){
                        if (w) {
                            w.emit('data', string);
                            w.emit('string', string);
                        }
                    }, 500);
                })(stringAnswers[i]);
            }
        }
    });
}

if(module.parent) module.exports = function(worker){w=worker};
else require(process.env.NODE_RUN)(function(worker){
    w=worker
});
