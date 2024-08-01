import { auth, qix } from "@qlik/api";
import { HostConfig } from "@qlik/api/auth";
import { NxPage, NxDataPage } from "@qlik/api/qix";
import * as crypto from "crypto";

const hostConfig: HostConfig = {
  authType: "apikey",
  host: "xxxx.yy.qlikcloud.com",
  apiKey: "eyJhbGciOi...."
};
auth.setDefaultHostConfig(hostConfig);

async function main() {
  const appid = "72a3da4b-1093-4c4c-840d-1ee44fbcbb91";
  let session = null;
  try {
    session = qix.openAppSession({ appId: appid, withoutData: false, identity: crypto.randomUUID() });
    const app = await session.getDoc();

    await app.clearAll();
    const field = await app.getField("支店名");
    const select_ok = await field.selectValues([{ qText: "関東支店" }, { qText: "関西支店" }]);

    const listobject_def = {
      qInfo: {
        qType: "my-list-object"
      },
      qListObjectDef: {
        qDef: {
          qFieldDefs: ["支店名"],
          qFieldLabels: ["支店名"],
          qSortCriterias: [{ qSortByLoadOrder: 1 }]
        },
        qFrequencyMode: "V",
        qShowAlternatives: true
      }
    };
    const lo_hypercube = await app.createSessionObject(listobject_def);
    let lo_layout = await lo_hypercube.getLayout();
    const lo_width = lo_layout.qListObject.qSize.qcx;
    const lo_height = (lo_width==0) ? 1 : Math.floor(10000 / lo_width);
    lo_layout.qListObject.qDataPages = [];
    async function getAllList(w: number, h: number, lr: number) {
      const requestPage: NxPage[] = [{qTop: lr, qLeft: 0, qWidth: w, qHeight: h}];
      const dataPages: NxDataPage[] = await lo_hypercube.getListObjectData("/qListObjectDef", requestPage);
      lo_layout.qListObject.qDataPages.push(dataPages[0]);
      const n = dataPages[0].qMatrix.length;
      if(lr + n >= lo_layout.qListObject.qSize.qcy) {
        return;
      }
      await getAllList(w, h, lr + n);
    }
    // Register an event listener for change events
    async function listobjectChanged() {
      console.log("listobject has beed changed.");
      //lo_layout = await lo_hypercube.getLayout();
      //lo_layout.qListObject.qDataPages = [];
      //await getAllList(lo_width, lo_height, 0);
    }
    lo_hypercube.on("changed", listobjectChanged);
    function renderingList() {
      const hc = lo_layout.qListObject, allListPages = hc.qDataPages;
      console.log(hc.qDimensionInfo.qFallbackTitle);
      for(const p of allListPages) {
        for(let r = 0; r < p.qMatrix.length; r++) {
          for(let c = 0; c < p.qMatrix[r].length; c++) {
            const cell = p.qMatrix[r][c];
            let field_data = cell.qElemNumber + ",";
            if( cell.qState=="S" )
              field_data += "(Selected)";
            if( cell.qElemNumber == -2 ) // -2: the cell is a Null cell.
              field_data += "-";
            else if( cell.hasOwnProperty("qText") )
              field_data += cell.qText;
            else if( cell.hasOwnProperty("qNum") )
              field_data += cell.qNum;
            else
              field_data += "";
            console.log(field_data);
          }
        }
      }
    }
    await getAllList(lo_width, lo_height, 0);
    renderingList();
    await app.destroySessionObject(lo_hypercube.id);

    const hypercube_def = {
      qInfo: {
        qType: "my-straight-hypercube"
      },
      qHyperCubeDef: {
        qDimensions: [{
          qDef: {
            qFieldDefs: ["営業員名"],
            qFieldLabels: ["営業員名"]
          },
          qNullSuppression: true
        }],
        qMeasures: [{
          qDef: {
            qDef: "Sum([販売価格])",
            qLabel: "実績",
            qNumFormat: {qType: "M", qUseThou: 1, qThou: ","}
          },
          qSortBy: {
            qSortByState: 0,
            qSortByFrequency: 0,
            qSortByNumeric: -1, // ソート: 0=無し, 1=昇順, -1=降順
            qSortByAscii: 0,
            qSortByLoadOrder: 0,
            qSortByExpression: 0,
            qExpression: { "qv": " " }
          }
        }],
        qSuppressZero: false,
        qSuppressMissing: false,
        qMode: "S",
        qInterColumnSortOrder: [1,0], // ソート順: 1=実績, 0=営業員名
        qStateName: "$"
      }
    };
    const hc_hypercube = await app.createSessionObject(hypercube_def);
    let hc_layout = await hc_hypercube.getLayout();
    const hc_width = hc_layout.qHyperCube.qSize.qcx;
    const hc_height = (hc_width==0) ? 1 : Math.floor(10000 / hc_width);
    hc_layout.qHyperCube.qDataPages = [];
    async function getAllData(w: number, h: number, lr: number) {
      const requestPage: NxPage[] = [{qTop: lr, qLeft: 0, qWidth: w, qHeight: h}];
      const dataPages: NxDataPage[] = await hc_hypercube.getHyperCubeData("/qHyperCubeDef", requestPage);
      hc_layout.qHyperCube.qDataPages.push(dataPages[0]);
      const n = dataPages[0].qMatrix.length;
      if(lr + n >= hc_layout.qHyperCube.qSize.qcy) {
        return;
      }
      await getAllData(w, h, lr + n);
    }
    // Register an event listener for change events
    async function hypercudeChanged() {
      console.log("hypercube has beed changed.");
      //hc_layout = await hc_hypercube.getLayout();
      //hc_layout.qHyperCube.qDataPages = [];
      //await getAllData(hc_width, hc_height, 0);
    }
    hc_hypercube.on("changed", hypercudeChanged);
    function renderingHyperCube() {
      const hc = hc_layout.qHyperCube, allDataPages = hc.qDataPages;
      for(const dim of hc.qDimensionInfo)
        console.log(dim.qFallbackTitle);
      for(const mes of hc.qMeasureInfo)
        console.log(mes.qFallbackTitle);
      for(const p of allDataPages) {
        for(let r = 0; r < p.qMatrix.length; r++) {
          for(let c = 0; c < p.qMatrix[r].length; c++) {
            const cell = p.qMatrix[r][c];
            let field_data = "";
            if( cell.qElemNumber == -2 ) // -2: the cell is a Null cell.
              field_data += "-";
            else if( cell.hasOwnProperty("qText") )
              field_data += cell.qText;
            else if( cell.hasOwnProperty("qNum") )
              field_data += cell.qNum;
            else
              field_data += "";
            console.log(field_data);
          }
        }
      }
    }
    await getAllData(hc_width, hc_height, 0);
    renderingHyperCube();
    await app.destroySessionObject(hc_hypercube.id);
  } catch(e) {
    console.error(e);
  } finally {
    if(session != null) {
      await session.close();
    }
  }
}
await main();