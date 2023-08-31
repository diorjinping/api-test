const apiInput = document.getElementById("api-url");
const analyzeBtn = document.getElementById("analyzeBtn");
const dnsInfoContainer=document.getElementById("dnsInfo")
const pathVariableContainer=document.getElementById('pathVariables')
const queryParamContainer=document.getElementById('queryParams')
const apiSelector=document.getElementById('known-api')
const knownHosts=[
    "localhost",
    "ec2d-map-graph-02.mypna.com",
    "graph-service-here-na.stg.k8s.mypna.com",
    "hqd-ssdpostgis-05.mypna.com"
]
const knownPorts=[
    "9080",
    "9085",
    "8080"
]

const currentAnalyzedUrl={
    url:null,
    protocol:null,  //bound string
    host:null,  // bound input element
    port:null,   // bound input element
    pathVariables:[], // bound input element
    queryParameters:new Map()
}

const knownApis={
    map_matching:{
        text:"graph map matching",
        value:""
    },
    road_bound_query:{
        text:"ngx road bound query",
        value:"http://localhost:9085/getRoadsByBound?maxLat={maxLat}&"+
            "minLat={minLat}&maxLon={maxLon}&minLon={minLon}&maxfc={maxfc}&"+
            "minfc={minfc}&product={product}&mergeLinks={boolean}"
    },
    feat_bound_query:{
        text:"ngx feature bound query",
        value:"http://localhost:9085/getFeatsByBound?maxLat={maxLat}&"+
            "minLat={minLat}&maxLon={maxLon}&minLon={minLon}&maxZoom={maxZoom}&"+
            "minZoom={minZoom}&product={product}"
    },
    openlr_decode:{
        text:"graph openlr decode",
        value:""
    }
}

function initComponents(){
    //make url display full content
    apiInput.addEventListener('input',(e)=>{
        apiInput.style.height='14px'
        apiInput.style.height=e.target.scrollHeight+'px'
    })
    // fill known api
    for (let key in knownApis) {
        let option=document.createElement('option')
        let perApi=knownApis[key]
        option.text=perApi.text
        option.value=perApi.value
        apiSelector.appendChild(option)
    }
    // bound select action
    document.getElementById('choose-api').addEventListener('click',function (){
        apiInput.textContent=apiSelector.options[apiSelector.selectedIndex].value
        apiInput.style.height=apiInput.scrollHeight+'px'
        analyzeAPI(apiInput.textContent)
    })
}
initComponents()


let createdElems=[]

const warningMessage={
    NOT_HTTP: "the api is not a http(s) request, please declare the protocol.",
    ONLY_HOST: "there is only host domain name, please declare uri.",
    ALREADY_ANALYZED: "the api is already analyzed."
}


function layerWarning(msg){
    layui.use(function (){
        let layer=layui.layer
        layer.msg(msg)
    })
}

function createInputVariable(pathVar){
    let inputElem=document.createElement('input')
    inputElem.setAttribute('class','path-variable-input')
    inputElem.value=pathVar
    return inputElem
}

function createLabeledInputWithCheck(labelName, inputValue){
    let label=document.createElement('label')
    label.textContent=labelName
    let inputElem=document.createElement('input')
    inputElem.value=inputValue
    let checkbox=document.createElement('checkbox')
    checkbox.setAttribute('checked','checked')
    return {
        label: label,
        input: inputElem,
        checkbox: checkbox
    }
}

function createLabeledSelect(labelName,defaultValue,optionValues,editable){
    let label=document.createElement('label')
    label.textContent=labelName
    let select=document.createElement('select')
    select.id=labelName
    let option=document.createElement('option')
    option.text=defaultValue
    option.value=defaultValue
    select.appendChild(option)
    let div=document.createElement('div')
    div.appendChild(label)
    let result = new Object()
    if(editable){
        let input=document.createElement('input')
        input.setAttribute('class','editableOptionInput')
        input.id=labelName
        input.value=defaultValue
        select.removeAttribute('id')
        select.addEventListener('change',function (){
            input.value=select.value
            input.dispatchEvent(new Event('change'))
        })
        select.setAttribute('class','editableOptionSelect')
        div.appendChild(input)
        result.input=input
    }
    for (let value of optionValues) {
        let option2=document.createElement('option')
        option2.text=value
        option2.value=value
        select.appendChild(option2)
    }
    div.appendChild(select)
    result.container=div
    return result
}

function processHostAndPort(hostAndPort){
    let split=hostAndPort.split(':')
    let res
    if(split.length>1){
        res= {
            host: split[0],
            port: split[1]
        }
    }else {
        res= {
            host: split[0],
            port: ''
        }
    }
    let hostInfo=createLabeledSelect('host',res.host,knownHosts,true)
    let portInfo=createLabeledSelect('port',res.port,knownPorts,true)
    currentAnalyzedUrl.host=hostInfo.input
    currentAnalyzedUrl.port=portInfo.input
    appendElems(dnsInfoContainer,[hostInfo.container,portInfo.container])
}

function appendElems(container, elems){
    for (let i = 0; i < elems.length; i++) {
        let elem=elems[i]
        container.appendChild(elem)
        createdElems.push(elem)
    }
}

function appendSepElements(container, needSeparator, ...elements){
    for (let i = 0; i < elements.length; i++) {
        let elem=elements[i]
        container.appendChild(elem)
        createdElems.push(elem)
        if(needSeparator){
            let label=document.createElement('label')
            label.textContent='/'
            label.setAttribute('class','path-variable-separator')
            container.appendChild(label)
            createdElems.push(label)
        }
    }
}

function appendLabeledInputPairs(container, elems){
    for (let pair of elems) {
        container.appendChild(pair.label)
        createdElems.push(pair.label)
        container.appendChild(pair.input)
        createdElems.push(pair.input)
        let seg=document.createElement('p')
        container.appendChild(seg)
        createdElems.push(seg)
    }
}

function clearCreatedElems(){
    for (let createdElem of createdElems) {
        createdElem.parentNode.removeChild(createdElem)
    }
    createdElems=[]
}

function generateUrl(){
    let pathVarsJoined=currentAnalyzedUrl.pathVariables.map((p)=>p.value).join('/')
    let queryParams=[]
    for (let [key,value] of currentAnalyzedUrl.queryParameters.entries()) {
        queryParams.push(key+'='+value.value)
    }
    let port=currentAnalyzedUrl.port.value.trim()===''?'':':'+currentAnalyzedUrl.port.value
    let queryParamsJoined=queryParams.join('&')
    let urlNew=currentAnalyzedUrl.protocol+currentAnalyzedUrl.host.value+port+'/'+pathVarsJoined+'?'+queryParamsJoined
    currentAnalyzedUrl.url=urlNew
    return urlNew
}

function analyzeAPI(url){
    if (currentAnalyzedUrl.url === null || currentAnalyzedUrl.url !== url) {
        currentAnalyzedUrl.url=url
        clearCreatedElems()
    }else {
        layerWarning(warningMessage.ALREADY_ANALYZED)
        return
    }
    let urlStr = url.toString();
    let isHttp=urlStr.startsWith('http') || urlStr.startsWith('https')
    if(isHttp){
        let protocolPat=/https?:\/\//
        let req=urlStr.replace(protocolPat,'')
        let protocol=protocolPat.exec(urlStr)
        currentAnalyzedUrl.protocol=protocol[0]
        //?queryParams is optional, pathVariable is default
        let split=req.split("/")
        if(split.length === 1){
            layerWarning(warningMessage.ONLY_HOST)
        }else {
            let pathVariables=[]
            let queryParams=new Map()
            // process dns information
            processHostAndPort(split[0])
            let lastPart=split[split.length-1]
            //process path variables
            if(split.length>2){
                for (let item of split.slice(1, split.length - 1)) {
                    pathVariables.push(item)
                }
            }
            let split2=lastPart.split('?')
            pathVariables.push(split2[0])
            pathVariables.forEach(p => {
                let varInput = createInputVariable(p)
                appendSepElements(pathVariableContainer,true,varInput)
                currentAnalyzedUrl.pathVariables.push(varInput)
            })
            //process query parameters
            if(split2.length>1){
                for (let each of split2[1].split('&')) {
                    let param=each.split('=')
                    if(param.length>1){
                        queryParams.set(param[0],param[1])
                    }
                }
                currentAnalyzedUrl.queryParameters=queryParams
                for (let [key,value] of queryParams.entries()) {
                    let created=createLabeledInputWithCheck(key,value)
                    appendLabeledInputPairs(queryParamContainer,[created])
                    currentAnalyzedUrl.queryParameters.set(key, created.input)
                }
            }
        }
        // bound field changer
        let inputs=createdElems.filter((elem)=> elem.tagName==='INPUT')
        inputs.push(currentAnalyzedUrl.host, currentAnalyzedUrl.port)
        inputs.forEach((elem) =>{
                elem.addEventListener('change',function (e){
                    apiInput.textContent=generateUrl()
                })
        })
    }else{
        layerWarning(warningMessage.NOT_HTTP)
    }
}

analyzeBtn.addEventListener("click",function (){
    analyzeAPI(apiInput.value)
})
