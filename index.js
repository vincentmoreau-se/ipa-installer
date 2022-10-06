const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const jszip = require('jszip');
const plist = require('plist');

const app = express();

const host =  process.env.HOST || 'localhost';
const prefix = process.env.PREFIX || '';
const port = process.env.PORT || 8080;
const protocol = process.env.PROTOCOL || 'http';
const url = protocol+'://'+host+prefix;


// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

//add other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(morgan('dev'));

app.get(prefix+'/', async (req, res) => {
    try {
      let directory_name = "uploads";
      
      let content = '<!doctype html><html><head><meta charset="UTF-8"/><title>Liste des builds iOS</title><meta name="viewport" content="width=device-width,initial-scale=1" />'+
      '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-Zenh87qX5JnK2Jl0vWa8Ck2rdkQ2Bzep5IDxbcnCeuOxjzrPF/et3URy9Bv1WTRi" crossorigin="anonymous">'+
      '<style type="text/css">'+
      '#loader {display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100%; background: rgba(0,0,0,0.75); z-index: 10000;} '+
      '#loader img{ left: 50%; margin-left: -32px; margin-top: -32px; position: absolute; top: 50%;}</style></head>' + 
        '<body>\n<h1><center>Liste des builds iOS</center></h1><hr>\n' +
        '<ol>\n';
        
        
        
      // Function to get current filenames
      // in directory
      let filenames = fs.readdirSync(directory_name);
      filenames = filenames.map(function (fileName) {
        return {
          name: fileName,
          time: fs.statSync(directory_name + '/' + fileName).mtime.getTime()
        };
      })
      .sort(function (a, b) {
        return a.time - b.time; })
      .map(function (v) {
        return v.name; });
        
      console.log("\nFilenames in directory:");
      filenames.forEach((file) => {
          console.log("File:", file);
          if (path.extname(file)==='.plist') {
            content += '<li><p><a href="itms-services://?action=download-manifest&amp;url='+url+'/'+file+'" id="text">'+path.basename(file, '.plist')+'</a></p></li>\n';
          }
      });
      content += '</ol>\n<hr>\n' +
        '<form id="myform" class="form vertical" action="'+url+'/upload-ipa" method="post" enctype="multipart/form-data">' +
        '<div class="mb-3"><label for="formFile" class="form-label">Pour uploader un IPA c\'est ici :</label><input class="form-control" type="file" id="formFile" name="fileupload"></div><button class="btn btn-primary" type="submit">Submit</button>' +
        '</form><div id="loader"><img src="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/0.16.1/images/loader-large-inverted.gif" alt="processing..." /></div>' +
        '<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"></script>'+
        '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-OERcA2EqjJCMA+/3y+gxIOqMEjwtxJY7qPCqsdltbNJuaOe923+mo//f6V8Qbsw3" crossorigin="anonymous"></script>' +
        '<script> $(document).ready(function(){  $("#myform").on("submit", function(){ $("#loader").fadeIn(); }); });</script>'+
        '</body></html>';
      res.send(content);
        
    } catch (err) {
        res.status(500).send(err);
    }
});

app.post(prefix+'/upload-ipa', async (req, res) => {
    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            //Use the name of the input field (i.e. "avatar") to retrieve the uploaded file
            let ipa = req.files.fileupload;
            console.log(ipa);
            
            // Get bundle id and other stuff
            //const fileContent = fs.readFileSync(ipa.name);
            const jsZipInstance = new jszip();
            const result = await jsZipInstance.loadAsync(ipa.data);
            const keys = Object.keys(result.files);
            
            var bundleVersion = "";
            var bundleIdentifier = "";
            var bundleShortVersionString = "";
            var bundleName = "";
            
            for (let key of keys) {
              const item = result.files[key]
              if (/^Payload\/.*\.app\/Info.plist$/.test(item.name)) {
                console.log(item.name);
                var params = plist.parse(await item.async('string'));
                
                bundleShortVersionString = params.CFBundleShortVersionString;
                bundleIdentifier = params.CFBundleIdentifier;
                bundleVersion = params.CFBundleVersion;
                console.log(params.CFBundleIdentifier);
                console.log(params.CFBundleShortVersionString);
                console.log(params.CFBundleVersion);
                bundleName = params.CFBundleName;
              }
            }
            
            //Use the mv() method to place the file in the upload directory (i.e. "uploads")
            ipa.mv('./uploads/' + bundleName + '_'+bundleVersion+'_'+bundleShortVersionString+'.ipa');
            
            let pListContent = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd ">'+
              '<plist version="1.0"><dict><key>items</key><array><dict><key>assets</key><array><dict><key>kind</key><string>software-package</string><key>url</key>'+
              '<string>'+url+'/'+bundleName + '_'+bundleVersion+'_'+bundleShortVersionString+'.ipa'+'</string>' +
              '</dict></array><key>metadata</key><dict><key>bundle-identifier</key><string>'+bundleIdentifier+'</string><key>bundle-version</key><string>'+bundleVersion+'</string><key>kind</key>'+
               '<string>software</string><key>title</key><string>'+bundleName+'</string></dict></dict></array></dict></plist>';
            fs.writeFileSync('./uploads/' + bundleName + '_'+bundleVersion+'_'+bundleShortVersionString+'.plist', pListContent);

            //send response
            res.redirect(prefix+'/');
        }
    } catch (err) {
        res.status(500).send(err);
        throw(err);
    }
});


app.use(prefix, express.static('uploads'));

//start app 


app.listen(port, () => 
  console.log(`App is listening on port ${port}.`)
);
