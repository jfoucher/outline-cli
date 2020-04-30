require('dotenv').config()
const getenv = require('getenv');
const editor = require('editor')
const readline = require("readline");
const tmp = require('tmp');
const axios = require('axios')
fs = require('fs');
var spawnSync = require('child_process').spawnSync;
process.stdin.setEncoding('utf8');
process.stdin.setRawMode(true);    
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const apiUrl = getenv('API_URL');
const apiToken = getenv('API_TOKEN');

axios.get(apiUrl + '/collections.list?limit=100&token='+apiToken).then((resp) => {
    let selectedCollection = null;
    const collections = resp.data.data;
    const collectionsQuestion = collections.map((c, i) => i + ': ' + c.name).join('\n') + '\nYour choice: ';
    
    var recursiveAsyncReadLine = function () {
        rl.question("Choose a collection\n" + collectionsQuestion, function(col) {
            if (typeof collections[col] === 'undefined') {
                console.log('This collection does not exist');
                recursiveAsyncReadLine()
            }

            selectedCollection = collections[col];
            rl.question("Post Title: ", function(title) {
                axios.post(apiUrl+'/documents.create', {
                    token: apiToken,
                    collectionId: selectedCollection.id,
                    title: title,
                    text: '',
                }).then(res => {

                    var ed = /^win/.test(process.platform) ? 'notepad' : 'vim';
                    var editor = process.env.VISUAL || process.env.EDITOR || ed;
                    var args = editor.split(/\s+/);
                    var bin = args.shift();
                    obj = tmp.fileSync()
                    const filename = obj.name;
                    obj.removeCallback();

                    spawnSync(bin, [filename], { stdio: 'inherit', detached: true });

                    
                    const text = fs.readFileSync(filename, 'utf8')

                    console.log(text);
                    axios.post(apiUrl+'/documents.update', {
                        token: apiToken,
                        text: text,
                        title: title,
                        id: res.data.data.id,
                    }).then(res => {
                        //console.log(res.data.data);
                        console.log('Your document was created.')
                        console.log('You can view it here: ' + getenv('SERVER_URL') + res.data.data.url)
                        rl.question("Publish (Y/n)? ", function(pub) {
                            if (pub.toLowerCase === 'y' || pub === '') {
                                axios.post(apiUrl+'/documents.update', {
                                    token: apiToken,
                                    title: title,
                                    publish: true,
                                    done: true,
                                    id: res.data.data.id,
                                }).then((res) => {
                                    console.log('Your document is now published: ' + getenv('SERVER_URL') + res.data.data.url)
                                    process.exit(0);
                                }).catch(e => {
                                    console.log(e)
                                    process.exit(1);
                                })
                            } else {
                                process.exit(0);
                            }
                        });
                        
                    }).catch(e => {
                        console.log(e);
                        process.exit(1);
                    })
                }).catch(e => {
                    console.log(e);
                    process.exit(1);
                })
            });
        })
    }

    recursiveAsyncReadLine()
}).catch(er => {
    console.log('Could not read your collections. Please make sure the parameters in the .env file are correct and that you are connected to the internet');
    process.exit(1);
})


// rl.question("Post Title: ", function(title) {

//     console.log(getenv('SERVER_URL'));

//     editor('')
//     .on('data', (text) => {
//         // do something with the text
//         //console.log('data',text)
//     })
//     .on('abort', (text) => {
//         // do something with the text
//         console.log('abort',text)
//     })
//     .on('submit', (text) => {
//         // do something with the text
//         console.log('submit', text)
//     })
// });

