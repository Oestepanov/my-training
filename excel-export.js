/* Local Excel export. No network requests or external dependencies. */
(function(root){
 'use strict';
 const encoder=new TextEncoder();
 const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 const xml=value=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g,'').slice(0,32767).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const numeric=value=>typeof value==='number'&&Number.isFinite(value)?value:0;
 const column=index=>{let name='';for(let n=index+1;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;};
 function dateCell(value){
  const ms=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?Date.parse(value+'T00:00:00Z'):NaN;
  return Number.isFinite(ms)?{value:ms/86400000+25569,style:2}:{value:String(value||'')};
 }
 function cell(value,style=0){return{value,style};}
 function performed(exercise){
  if(Array.isArray(exercise.setDetails))return exercise.setDetails.map((s,i)=>({...s,index:i+1})).filter(s=>s.done===true);
  if(!exercise.completed)return[];
  const count=Number.isInteger(exercise.sets)&&exercise.sets>0?exercise.sets:3;
  return Array.from({length:count},(_,i)=>({index:i+1,weight:numeric(exercise.weight),reps:numeric(exercise.reps)}));
 }
 function sheetsFor(state){
  const workouts=new Map((state.workouts||[]).map(w=>[String(w.id),w]));
  const summary=[['Дата','Тренировка','Упражнений выполнено','Подходов выполнено','Всего повторений','Объём, кг × повторы','Заметка'].map(v=>cell(v,1))];
  const detail=[['Дата','Тренировка','Упражнение','Подход','Вес, кг','Повторения','Объём, кг × повторы'].map(v=>cell(v,1))];
  const sessions=[...(state.history||[])].filter(s=>!s.deleted).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt||a.id).localeCompare(String(b.createdAt||b.id)));
  for(const session of sessions){
   const workout=workouts.get(String(session.workoutId));
   const workoutName=workout?.name||'Тренировка №'+session.workoutId;
   let exerciseCount=0,setCount=0,reps=0,volume=0;
   for(const exercise of session.exercises||[]){
    const sets=performed(exercise);if(!sets.length)continue;
    const name=exercise.name||workout?.exercises?.find(e=>e.id===exercise.exerciseId)?.name||exercise.exerciseId;
    exerciseCount++;
    for(const set of sets){
     const weight=numeric(set.weight),repeat=numeric(set.reps),work=Math.round(weight*repeat*100)/100;
     setCount++;reps+=repeat;volume+=work;
     detail.push([dateCell(session.date),cell(workoutName),cell(name),cell(set.index,4),cell(weight,3),cell(repeat,4),cell(work,3)]);
    }
   }
   summary.push([dateCell(session.date),cell(workoutName),cell(exerciseCount,4),cell(setCount,4),cell(reps,4),cell(Math.round(volume*100)/100,3),cell(session.notes||'')]);
  }
  return[
   {name:'Тренировки',rows:summary,widths:[14,23,23,23,21,25,44]},
   {name:'Подходы',rows:detail,widths:[14,23,37,12,14,17,25]}
  ];
 }
 function sheetXML(sheet){
  const rows=sheet.rows;
  if(rows.length>1048576)throw new Error('Слишком много строк для одного листа Excel.');
  const last=column(sheet.widths.length-1)+rows.length;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
   '<worksheet xmlns="'+NS+'"><dimension ref="A1:'+last+'"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="21"/>'+
   '<cols>'+sheet.widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols><sheetData>'+
   rows.map((row,i)=>'<row r="'+(i+1)+'"'+(!i?' ht="32" customHeight="1"':'')+'>'+row.map((c,j)=>{
    const ref=column(j)+(i+1),attrs=' r="'+ref+'" s="'+(c.style||0)+'"';
    return typeof c.value==='number'&&Number.isFinite(c.value)?'<c'+attrs+'><v>'+c.value+'</v></c>':'<c'+attrs+' t="inlineStr"><is><t xml:space="preserve">'+xml(c.value)+'</t></is></c>';
   }).join('')+'</row>').join('')+'</sheetData><autoFilter ref="A1:'+last+'"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>';
 }
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="'+NS+'"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/><numFmt numFmtId="165" formatCode="#,##0.##"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF263A25"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
 function zip(files){
  const local=[],central=[];let offset=0,size=0;
  for(const [path,text]of files){
   const name=encoder.encode(path),body=encoder.encode(text),crc=crc32(body);
   const header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
   view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);view.setUint16(12,33,true);view.setUint32(14,crc,true);view.setUint32(18,body.length,true);view.setUint32(22,body.length,true);view.setUint16(26,name.length,true);header.set(name,30);
   local.push(header,body);
   const entry=new Uint8Array(46+name.length),cv=new DataView(entry.buffer);
   cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,body.length,true);cv.setUint32(24,body.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);entry.set(name,46);
   central.push(entry);offset+=header.length+body.length;size+=entry.length;
  }
  const end=new Uint8Array(22),ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);
  const output=new Uint8Array(offset+size+end.length);let cursor=0;
  for(const part of [...local,...central,end]){output.set(part,cursor);cursor+=part.length;}
  return output;
 }
 function buildWorkbook(state){
  const sheets=sheetsFor(state),relsNS='http://schemas.openxmlformats.org/package/2006/relationships';
  const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>';
  const workbook='<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="'+NS+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>';
  const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="'+relsNS+'">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  return zip([
   ['[Content_Types].xml',types],
   ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="'+relsNS+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
   ['xl/workbook.xml',workbook],['xl/_rels/workbook.xml.rels',rels],['xl/styles.xml',styles],
   ...sheets.map((s,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',sheetXML(s)])
  ]);
 }
 root.TrainingExcel={buildWorkbook,mimeType:MIME};
 if(typeof module!=='undefined')module.exports=root.TrainingExcel;
})(globalThis);
