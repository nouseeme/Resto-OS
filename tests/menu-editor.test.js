import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'vite';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

test('menu editor renders with the production JSX transform and configured image controls',async()=>{
  const directory='node_modules/.cache/resto-menu-editor-test';
  await build({configFile:false,logLevel:'silent',build:{ssr:'src/MenuEditor.jsx',outDir:directory,emptyOutDir:true,rollupOptions:{output:{entryFileNames:'editor.mjs'}}}});
  const {default:Editor}=await import(pathToFileURL(path.resolve(directory,'editor.mjs')));
  const Modal=({children})=>React.createElement('section',null,children);
  const Field=({label,children})=>React.createElement('label',null,label,children);
  const Button=({kind,...props})=>React.createElement('button',props);
  const props={act:async()=>true,onClose(){},Modal,Field,Button};
  const enabled=renderToStaticMarkup(React.createElement(Editor,{...props,imagesEnabled:true}));
  assert.match(enabled,/Foto menu/);assert.match(enabled,/type="file"/);assert.match(enabled,/Simpan menu/);
  const disabled=renderToStaticMarkup(React.createElement(Editor,{...props,imagesEnabled:false}));
  assert.match(disabled,/belum dikonfigurasi/);assert.doesNotMatch(disabled,/type="file"/);
});
