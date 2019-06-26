const Q = require('q');
const crud = require('crud-sdk');
const fs = require('fs');
const ipfsAPI = require('ipfs-api');
const ipfs = ipfsAPI('ipfs.infura.io', '5001', {protocol: 'https'});

// const mongoURL = 'mongodb://127.0.0.1:27017/';
// const dbName ='filehashes'
// const collectionName = 'hashes'

let mongoURL = "";
let dbName = "";
let collectionName = "";

//to delete files after use
const { promisify } = require('util')
const unlinkAsync = promisify(fs.unlink)


service = {}

module.exports = service;

service.returnFiles = returnFiles;
service.uploadFiles = uploadFiles;
service.deleteFile = deleteFile;

function uploadFiles(files, formdata, dbinfo){ 
    //Accepts three arguments: req.files which contains an array of file data, 
    //req.body which contains form data that is to be binded to the file data in an array of JSON in string format
    //req.query which contains the connection string, database name and collection name where the files are to be stored
    //Calls a synchronous function hashIt() which uses the ipfs-api to hash the uploaded files
    var deferred = Q.defer();
    mongoURL = dbinfo.cs;
    dbName = dbinfo.db;
    collectionName = dbinfo.coll;
    hashIt(files, formdata)
        .then(() =>{
            deferred.resolve();    
        })
        .catch(err=>{
            deferred.reject(err);
        })
    return deferred.promise;
}

async function hashIt(files, formdata){
    //Calls addFilesToIPFS that generates a unique hash for the file,
    // then calls storeFiles which uploads each hashed file to the database
    var data = JSON.parse(formdata.fileInformation); //converts the array of JSON passed from client in string back to JSON format
    
    
    await new Promise(next => {
    for(let i=0; i<files.length;i++){ //loops through the array of files
        let testFile = fs.readFileSync(files[i].destination + files[i].filename);
        //Creating buffer for ipfs function to add file to the system
        let testBuffer = new Buffer.from(testFile); 
        addFilesToIPFS(testBuffer)
            .then((hashedfile)=>{
            //Binding the returned hash of the respective file to the rest of the file data
            files[i].hash = hashedfile.hash;
            //urlForAccess can be used to display the file in a normal browser without running the ipfs daemon
            files[i].urlForAccess = "https://ipfs.io/ipfs/" + files[i].hash;
            //Binding the rest of the form data to the respective file
            Object.assign(files[i],data[i]); 
            //stores file in the database
            storeFiles(files[i]);
            //to delete the file from server after storing in the database
            unlinkAsync(files[i].destination + files[i].filename); 
            next();
            })
            .catch((err)=>{
                console.log('Error in hashing file!')
                Promise.reject(err);
            })
        }
    })
}


async function addFilesToIPFS(testBuffer){
    //uses the ipfs-api to generate a unique content-based hash for the file
    var deferred = Q.defer();
    await ipfs.files.add(testBuffer, function (err, hashedfile) {
        if (err) {
            console.log(err);
            deferred.reject(err);
        }
        //returns only the hash of the file
        deferred.resolve(hashedfile[0]); 
    })
    return deferred.promise;
}

function storeFiles(oneFile) {
    //Stores the JSON of file data in the database
    var deferred = Q.defer();
    crud.create(mongoURL, dbName, collectionName, oneFile, function(err,data){
        if(err) {
            console.log(err);
            deferred.reject('Failed to upload file to the database');}
    })
    if(oneFile == undefined)
        deferred.reject('File is undefined');
    deferred.resolve();
    return deferred.promise;
}

function returnFiles(dbinfo){
    //Returns an array of JSON of all the file data from the database
    var deferred = Q.defer();
    mongoURL = dbinfo.cs;
    dbName = dbinfo.db;
    collectionName = dbinfo.coll;
    crud.readByCondition(mongoURL, dbName, collectionName,{},{},function(err,result){
        if(err)
            deferred.reject(err);
        deferred.resolve(result);
    })
    return deferred.promise;
}

async function deleteFile(_id, dbinfo){
    //deletes the file using the Object ID
    //initializing database information
    mongoURL = dbinfo.cs;
    dbName = dbinfo.db;
    collectionName = dbinfo.coll;
    var deferred = Q.defer();
    await crud.deleteById(mongoURL, dbName, collectionName, _id, function (err, result) {
        if (err) deferred.reject(err)
        deferred.resolve();
    });
    return deferred.promise;
}
