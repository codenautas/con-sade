import * as convert from 'xml-js';

// import * as https from "https";
import * as http from "http";
import * as MiniTools from "mini-tools"
import { promises as fs } from "fs";
import * as fullFs from "fs";

import * as querystring from 'querystring';

class Requester{
    public config={
        api:{
            username:'unkown',
            especial:'',
            baseTargetFolderPath:'',
            SERVICE_URL:'',
            BASE_SERVICE_PATH:'',
            envelopeURL:'',
            responseHeader:'',
            requestHeader:''
        }
    }
    constructor(){
    }
    async configurar(){
        this.config = await MiniTools.readConfig([
            this.config, 
            'local-config'
        ]);
        return;
    }
    async requerimiento<TRec extends string, T2Send extends {}>(
        data2send: T2Send,
        headers: http.RequestOptions['headers'],
        tipo?:'text'|'raw:xml'|null,
        method?:'GET'|'POST'|null
    ):Promise<TRec>{
        const postData = tipo==='raw:xml' ? data2send+'': tipo=='text' && method!='GET'?JSON.stringify(data2send):querystring.stringify(data2send);
        var data:string[]=[];
        // await fs.appendFile('local-result.log',(method||'POST')+' '+this.config.api.BASE_SERVICE_PATH+'\n','utf8');
        // await fs.appendFile('local-result.log',(typeof data2send == 'string'?data2send: JSON.stringify(data2send))+'\n','utf8');
        var result = await new Promise<string>((resolve, reject)=>{
            //console.log('por request')
            var req = http.request(this.config.api.SERVICE_URL,{
                method:method||'POST',
                timeout:7000,
                headers: {
                    'Content-Type': tipo=='raw:xml'?'application/xml':tipo=='text'?'text':'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                    ...headers
                },
                path:this.config.api.BASE_SERVICE_PATH+(method=='GET'?postData:''),
            }, (res) => {
                res.on('data', (chunk) => {
                    data.push(chunk);
                });
                res.on('end', () => {
                    console.log('end');
                    resolve(data.join(''));
                });
                res.on('error', (err) => {
                    console.log('dentor de error');
                    console.log(err);
                    reject(err);
                });
            });

            // use its "timeout" event to abort the request
            req.on('timeout', () => {
                reject({message:'timeout'});
            });

            if (method != 'GET') {
                req.write(postData);
            }
            req.end();
        });
        var text = result;
        // await fs.appendFile('local-result.log','#result:\n\n','utf8');
        // await fs.appendFile('local-result.log',text+'\n\n','utf8');
        return text as TRec;
    }
}

export class ToSADE extends Requester{
    async pedirYGuardarDocumento(documentoNumero:string, targetFolder:string){
        let dataToSend = 
            `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${this.config.api.envelopeURL}">
                <soapenv:Header/>
                <soapenv:Body>
                    <${this.config.api.requestHeader}>
                        <!--Optional:-->
                        <request>
                            <!--Optional:-->
                            ${documentoNumero?`<numeroDocumento>${documentoNumero}</numeroDocumento>`:''}
                            <!--Optional:-->
                            ${this.config.api.especial?`<numeroEspecial>${this.config.api.especial}</numeroEspecial>`:''}
                            <!--Optional:-->
                            <usuarioConsulta>${this.config.api.username}</usuarioConsulta>
                        </request>
                    </${this.config.api.requestHeader}>
                </soapenv:Body>
            </soapenv:Envelope>`
        var xmlText = await this.requerimiento<string, string>(dataToSend, {},'raw:xml')
        var datos = convert.xml2js(xmlText,{compact:true});
        // @ts-ignore
        var result = datos["soap:Envelope"]["soap:Body"][this.config.api.responseHeader]?.return?._text;
        if (result){
            var bin = Buffer.from(result, 'base64');
            var dir = this.config.api.baseTargetFolderPath+targetFolder
            if (!fullFs.existsSync(dir)){
                fullFs.mkdirSync(dir);
            }
            await fs.writeFile(dir+'/'+documentoNumero+'.pdf',bin);
        }
    }

    async descargarImg(caso:Caso){
        //TODO SE REPITE REFACTORIZAR
        if (caso.gedo){
            await this.pedirYGuardarDocumento(caso.gedo, caso.folderForTDOrigen);
        }
        if (caso.gedoRnp){
            await this.pedirYGuardarDocumento(caso.gedoRnp, caso.folderForTDOrigen);
        }
    }

    async descargarImgCasos(casos:Caso[]){
        for (const caso of casos) {
            await this.descargarImg(caso)
        }
    }
}

export class Caso{
    constructor(public gedo:string, public gedoRnp:string, public folderForTDOrigen:string){}
}

export async function prueba(){
    var tr = new ToSADE();
    await tr.configurar();
    let casoPrueba = new Caso('unGedo','unGedoRNP', 't2-20200212')
    await tr.descargarImg(casoPrueba);
}

//prueba();
