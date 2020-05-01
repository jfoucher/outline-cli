#!/usr/bin/env node

const inquirer = require('inquirer');
const axios = require('axios')
fs = require('fs');

let config = require(__dirname + '/../config.json');

let collections = config.collections;
let credentials = config.credentials;



const getCredentials = () => {
    inquirer
    .prompt([
    {
        type: 'input',
        name: 'server_url',
        message: "Server URL"
    },
    {
        type: 'input',
        name: 'api_token',
        message: "API token"
    },
    ])
    .then(answers => {
        credentials = {...answers};
        //Write to file
        fs.writeFile(__dirname + '/../config.json', JSON.stringify({ credentials, collections }), () => {
            console.log('saved credentials')
            getCollections();
        })
    })
    .catch(error => {
        console.log(error);
        if(error.isTtyError) {
            // Prompt couldn't be rendered in the current environment
        } else {
            // Something else when wrong
        }
    });
    
}


const getCollections = () => {
    const apiUrl = credentials.server_url + '/api';
    const req = axios.get(apiUrl + '/collections.list?limit=100&token='+credentials.api_token)
    req.then(res => {
        collections = res.data.data;
        fs.writeFile(__dirname + '/../config.json', JSON.stringify({ credentials, collections }), () => {

        })

        editOrCreate();
    }).catch((e) => {
        console.log('Could not get collections. Please make sure you are connected to the internet and your credentials are correct');

        getCredentials();
    });

    return req;
}

let collectionId = null;
let chosenLocation = null;

const publishDoc = (document) => {
    const apiUrl = credentials.server_url + '/api';
    inquirer
    .prompt([
        {
            type: 'list',
            name: 'publish',
            message: 'Do you want to publish your document?',
            choices: [
                'Yes',
                'No',
            ]
        },
    ]).then(answer => {
        if (answer.publish === 'Yes') {
            axios.post(apiUrl + '/documents.update', {
                token: credentials.api_token,
                title: document.title,
                publish: true,
                id: document.id,
            }).then((res) => {
                console.log('Document published at ' + credentials.server_url + res.data.data.url);
                getCollections();
            }).catch(() => {
                console.log('could not save document', e);
            })
        } else {
            getCollections();
        }
    }).catch(error => {
        console.log(error);
        if(error.isTtyError) {
            // Prompt couldn't be rendered in the current environment
        } else {
            // Something else when wrong
        }
    });
}

const editDocument = (document) => {
    const apiUrl = credentials.server_url + '/api';
    const questions = [
        {
            type: 'editor',
            name: 'text',
            message: 'Text',
            default: document ? document.text : ''
        },
    ];

    if (!document) {
        questions.unshift({
            type: 'input',
            name: 'title',
            message: "Title"
        },)
    }

    inquirer
    .prompt(questions)
    .then(answers => {
        const data = {
            token: credentials.api_token,
            title: answers.title,
            text: answers.text,
            collectionId,   
        };

        let endpoint = '/documents.create';

        if (document) {
            endpoint = '/documents.update';
            data.id = document.id;
        }

        if (chosenLocation && chosenLocation !== collectionId) {
            data.parentDocumentId = chosenLocation;
        }
        axios.post(apiUrl + endpoint, data).then((res) => {
            console.log('Document saved at ' + credentials.server_url + res.data.data.url);
            publishDoc(res.data.data);
        }).catch(() => {
            console.log('could not save document');
        })
    })
    .catch(error => {
        console.log(error);
        if(error.isTtyError) {
            // Prompt couldn't be rendered in the current environment
        } else {
            // Something else when wrong
        }
    });
}

const chooseLocation = (edit = false, parent) => {
    let target = collections;
    let type = 'collection'
    let key = 'name';
    
    if (parent) {
        target = parent.documents ? parent.documents : parent.children
        type = 'document'
        key = 'title';
    }

    const choices = target.map(c => {return { name: c[key], value: c.id }})

    if (parent && edit === false) {
        choices.push({name: '🎯 Create document here 🎯', value: 0})
    }

    if (parent && typeof parent.documents === 'undefined' && edit === true) {
        choices.push({name: '✅ Edit this document ✅', value: 0})
    }
    
    inquirer
  .prompt({
    type: 'list',
    name: 'parent',
    message: `In which ${type}?`,
    choices,
  })
  .then((answer) => {
      if (!parent) {
          collectionId = answer.parent
      }
      const child = target.find(t => t.id === answer.parent);

      if (edit && child && child.children && child.children.length === 0) {
        const apiUrl = credentials.server_url + '/api';
        axios.get(`${apiUrl}/documents.info?token=${credentials.api_token}&id=${child.id}`).then(res => {
            editDocument(res.data.data)
        })
      }else if (target.length && answer.parent !== null && child && (child.documents || child.children)) {
        chosenLocation = child.id;
        chooseLocation(edit, child)
    } else {
        // Do edit now
        if (edit) {
            //get document
            const apiUrl = credentials.server_url + '/api';
            axios.get(`${apiUrl}/documents.info?token=${credentials.api_token}&id=${chosenLocation}`).then(res => {
                editDocument(res.data.data)
            })
        } else {
            editDocument()
        }
    }
  });
}

const editOrCreate = () => {
    inquirer
    .prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What do you want to do?',
            choices: [
                'Create a new document',
                'Edit an existing document',
                'Exit'
                //'Create a collection'
            ]
        },
    ]).then(answer => {
        if (answer.action === 'Create a new document') {
            chooseLocation(false)
        }
        if (answer.action === 'Edit an existing document') {
            chooseLocation(true)
        }
        if (answer.action === 'Exit') {
            process.exit(0);
        }
    }).catch(error => {
        console.log(error);
        if(error.isTtyError) {
            // Prompt couldn't be rendered in the current environment
        } else {
            // Something else when wrong
        }
    });
}

if (typeof credentials === 'undefined' || !credentials) {
    getCredentials()
} else {
    getCollections();
}
