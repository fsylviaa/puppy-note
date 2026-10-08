/* DOM → editable SVG. No network requests, canvas screenshot, or foreignObject. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';
  const number = value => Math.round(Number(value) * 100) / 100;
  const px = value => Number.parseFloat(value) || 0;
  const transparent = value => !value || value === 'transparent' || /rgba\([^)]*,\s*0(?:\.0*)?\s*\)/.test(value);
  function make(name, attributes, text) {
    const result = document.createElementNS(NS, name);
    Object.entries(attributes || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') result.setAttribute(key, String(value));
    });
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function parts(value) {
    const output = []; let depth = 0, start = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] === '(') depth++;
      if (value[i] === ')') depth--;
      if (value[i] === ',' && depth === 0) { output.push(value.slice(start, i).trim()); start = i + 1; }
    }
    output.push(value.slice(start).trim()); return output;
  }
  function corner(value, width, height) {
    const pair = value.trim().split(/\s+/);
    const size = (s, axis) => s?.endsWith('%') ? px(s) * axis / 100 : px(s);
    return [Math.min(width / 2, size(pair[0], width)), Math.min(height / 2, size(pair[1] || pair[0], height))];
  }
  function roundedPath(box, style, inset = 0) {
    const x = box.x + inset, y = box.y + inset;
    const w = Math.max(0, box.width - inset * 2), h = Math.max(0, box.height - inset * 2);
    const corners = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(key =>
      corner(style['border' + key + 'Radius'] || '0', box.width, box.height).map(v => Math.max(0, v - inset)));
    const [[tlx, tly], [trx, try_], [brx, bry], [blx, bly]] = corners;
    const arc = (rx, ry, ex, ey) => rx && ry ? `A${number(rx)} ${number(ry)} 0 0 1 ${number(ex)} ${number(ey)}` : `L${number(ex)} ${number(ey)}`;
    return `M${number(x + tlx)} ${number(y)} H${number(x + w - trx)} ${arc(trx, try_, x + w, y + try_)} V${number(y + h - bry)} ${arc(brx, bry, x + w - brx, y + h)} H${number(x + blx)} ${arc(blx, bly, x, y + h - bly)} V${number(y + tly)} ${arc(tlx, tly, x + tlx, y)} Z`;
  }
  function isOnScreen(box, frame) {
    return box.x + box.width > 0 && box.y + box.height > 0 && box.x < frame.width && box.y < frame.height;
  }

  /**
   * Returns an SVG string. Download only on an explicit { download: true } call.
   * @param {HTMLElement|string} node Element or selector for the phone frame.
   * @param {string} fileName Suggested .svg filename.
   * @param {{download?:boolean,title?:string,description?:string,width?:number}} options
   */
  window.puppyExportSVG = function (node, fileName, options = {}) {
    if (typeof node === 'string') node = document.querySelector(node);
    if (!node || node.nodeType !== 1) throw new TypeError('请选择要导出的手机界面。');
    const origin = node.getBoundingClientRect();
    if (!origin.width || !origin.height) throw new Error('手机界面当前不可见，无法导出。');
    const outputWidth = Math.min(390, options.width || origin.width);
    const outputHeight = outputWidth / origin.width * origin.height;
    const svg = make('svg', {
      xmlns: NS, 'xmlns:xlink': XLINK, width: number(outputWidth), height: number(outputHeight),
      viewBox: `0 0 ${number(origin.width)} ${number(origin.height)}`, role: 'img',
      'data-export': 'puppy-notebook-editable-layers', version: '1.1'
    });
    svg.appendChild(make('title', {}, options.title || fileName || '小狗记事本'));
    svg.appendChild(make('desc', {}, options.description || '可编辑 SVG 界面：文字、卡片、边框和图标保持独立矢量图层；小狗形象与照片保留原始图片。'));
    const defs = make('defs'); svg.appendChild(defs);
    let sequence = 0;
    const layerName = (element, suffix = '') => {
      const source = element.id || element.getAttribute('data-layer') || element.getAttribute('aria-label') ||
        String(element.className?.baseVal ?? element.className ?? '').trim().split(/\s+/)[0] || element.tagName.toLowerCase();
      return `layer-${source.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 70)}${suffix}-${++sequence}`;
    };
    const relativeBox = rect => ({ x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height });
    const frame = { x: 0, y: 0, width: origin.width, height: origin.height };
    function clipFor(box, style, name) {
      const id = `clip-${name}`;
      const clip = make('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
      clip.appendChild(make('path', { d: roundedPath(box, style) })); defs.appendChild(clip);
      return `url(#${id})`;
    }
    function backgroundPaint(value, box, name) {
      if (!value || value === 'none') return null;
      const match = value.match(/^linear-gradient\((.*)\)$/);
      if (!match) return null;
      const items = parts(match[1]); let angle = 180;
      if (/^(?:-?[\d.]+deg|to\s)/.test(items[0])) {
        const direction = items.shift();
        if (direction.includes('deg')) angle = px(direction);
        else angle = direction.includes('right') ? 90 : direction.includes('left') ? 270 : direction.includes('top') ? 0 : 180;
      }
      const radians = angle * Math.PI / 180;
      const dx = Math.sin(radians) / 2, dy = -Math.cos(radians) / 2;
      const id = `gradient-${name}`;
      const gradient = make('linearGradient', { id, x1: `${(0.5 - dx) * 100}%`, y1: `${(0.5 - dy) * 100}%`, x2: `${(0.5 + dx) * 100}%`, y2: `${(0.5 + dy) * 100}%` });
      items.forEach((item, index) => {
        const stop = item.match(/^(.*?)(?:\s+(-?[\d.]+)%\s*)?$/);
        gradient.appendChild(make('stop', { offset: `${stop[2] ?? index / Math.max(1, items.length - 1) * 100}%`, 'stop-color': stop[1] }));
      });
      defs.appendChild(gradient); return `url(#${id})`;
    }
    function paintBox(group, element, box, style, name) {
      if (!transparent(style.backgroundColor)) group.appendChild(make('path', {
        id: name + '-background', d: roundedPath(box, style), fill: style.backgroundColor
      }));
      const gradient = backgroundPaint(style.backgroundImage, box, name);
      if (gradient) group.appendChild(make('path', { id: name + '-gradient', d: roundedPath(box, style), fill: gradient }));
      const imageMatch = style.backgroundImage?.match(/^url\(["']?(data:[^"']+)["']?\)$/);
      if (imageMatch) {
        group.appendChild(make('image', { id: name + '-background-image', x: number(box.x), y: number(box.y), width: number(box.width), height: number(box.height), href: imageMatch[1], preserveAspectRatio: style.backgroundSize === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice', 'clip-path': clipFor(box, style, name + '-image') }));
      }
      const borders = ['Top', 'Right', 'Bottom', 'Left'].map(side => ({ width: px(style['border' + side + 'Width']), color: style['border' + side + 'Color'], style: style['border' + side + 'Style'] }));
      const visible = borders.filter(b => b.width && !transparent(b.color) && b.style !== 'none');
      if (!visible.length) return;
      const first = borders[0];
      if (borders.every(b => b.width === first.width && b.color === first.color && b.style === first.style)) {
        group.appendChild(make('path', { id: name + '-border', d: roundedPath(box, style, first.width / 2), fill: 'none', stroke: first.color, 'stroke-width': first.width, 'stroke-dasharray': first.style === 'dashed' ? `${first.width * 3} ${first.width * 2}` : first.style === 'dotted' ? `${first.width} ${first.width * 2}` : null }));
      } else {
        const lines = [
          [box.x, box.y + borders[0].width / 2, box.x + box.width, box.y + borders[0].width / 2],
          [box.x + box.width - borders[1].width / 2, box.y, box.x + box.width - borders[1].width / 2, box.y + box.height],
          [box.x, box.y + box.height - borders[2].width / 2, box.x + box.width, box.y + box.height - borders[2].width / 2],
          [box.x + borders[3].width / 2, box.y, box.x + borders[3].width / 2, box.y + box.height]
        ];
        borders.forEach((b, i) => { if (b.width && b.style !== 'none' && !transparent(b.color)) group.appendChild(make('path', { id: `${name}-border-${i}`, d: `M${lines[i].map(number).slice(0, 2).join(' ')} L${lines[i].map(number).slice(2).join(' ')}`, fill: 'none', stroke: b.color, 'stroke-width': b.width, 'stroke-dasharray': b.style === 'dashed' ? '4 3' : b.style === 'dotted' ? '1 3' : null })); });
      }
    }
    function textAttributes(style) {
      return {
        fill: style.color, 'font-family': style.fontFamily, 'font-size': style.fontSize,
        'font-weight': style.fontWeight, 'font-style': style.fontStyle,
        'letter-spacing': style.letterSpacing === 'normal' ? undefined : style.letterSpacing,
        'text-decoration': style.textDecorationLine === 'none' ? undefined : style.textDecorationLine,
        'dominant-baseline': 'text-before-edge', 'xml:space': 'preserve'
      };
    }
    function paintText(textNode, group, parent, style, name) {
      if (!textNode.nodeValue.trim()) return;
      const runName = `${name}-run-${++sequence}`;
      const raw = textNode.nodeValue;
      const range = document.createRange(); let offset = 0, line = null, lineIndex = 0;
      const flush = () => {
        if (!line || !line.text.trim()) { line = null; return; }
        let content = line.text;
        if (style.textTransform === 'uppercase') content = content.toUpperCase();
        if (style.textTransform === 'lowercase') content = content.toLowerCase();
        const item = make('text', { id: `${runName}-text-${++lineIndex}`, x: number(line.x), y: number(line.y), ...textAttributes(style) }, content);
        group.appendChild(item); line = null;
      };
      for (const character of raw) {
        const length = character.length;
        range.setStart(textNode, offset); range.setEnd(textNode, offset + length); offset += length;
        const rects = Array.from(range.getClientRects());
        const rect = rects.find(r => r.width > 0.05 && r.height > 0);
        if (!rect) { if (character === '\n' && /pre|break-spaces/.test(style.whiteSpace)) flush(); continue; }
        const box = relativeBox(rect);
        if (!isOnScreen(box, frame)) { flush(); continue; }
        if (line && (Math.abs(line.y - box.y) > Math.max(2, box.height * 0.15) || box.x < line.x - 1 || box.x > line.end + 5)) flush();
        if (!line) line = { x: box.x, y: box.y, end: box.x, text: '' };
        line.text += /\s/.test(character) && !/pre|break-spaces/.test(style.whiteSpace) ? ' ' : character;
        line.end = Math.max(line.end, box.x + box.width);
      }
      flush(); range.detach?.();
    }
    function paintControl(element, group, box, style, name) {
      const tag = element.tagName.toLowerCase();
      if (tag === 'input' && ['checkbox', 'radio'].includes(element.type)) {
        // Native control borders are painted by the browser, not by computed CSS.
        const accent = style.accentColor && style.accentColor !== 'auto' ? style.accentColor : '#f2d786';
        group.appendChild(make(element.type === 'radio' ? 'ellipse' : 'rect', {
          id: name + '-native-control',
          ...(element.type === 'radio' ? {cx:number(box.x+box.width/2),cy:number(box.y+box.height/2),rx:number(box.width/2-1),ry:number(box.height/2-1)} : {x:number(box.x+1),y:number(box.y+1),width:number(box.width-2),height:number(box.height-2),rx:4}),
          fill: element.checked ? accent : '#fffef9', stroke: style.color, 'stroke-width': 1.5
        }));
        if (element.checked) group.appendChild(make('path', { id: name + '-check', d: `M${number(box.x + box.width * 0.2)} ${number(box.y + box.height * 0.52)} L${number(box.x + box.width * 0.43)} ${number(box.y + box.height * 0.75)} L${number(box.x + box.width * 0.82)} ${number(box.y + box.height * 0.25)}`, fill: 'none', stroke: style.color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
        return;
      }
      let value = tag === 'select' ? element.selectedOptions?.[0]?.textContent : element.value;
      let color = style.color;
      if (!value && element.placeholder) { value = element.placeholder; color = getComputedStyle(element, '::placeholder').color || color; }
      if (!value) return;
      const x = box.x + px(style.borderLeftWidth) + px(style.paddingLeft);
      const top = box.y + px(style.borderTopWidth) + px(style.paddingTop);
      const fontSize = px(style.fontSize), lineHeight = px(style.lineHeight) || fontSize * 1.2;
      const available = box.width - px(style.paddingLeft) - px(style.paddingRight) - px(style.borderLeftWidth) - px(style.borderRightWidth);
      const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const lines = []; String(value).split('\n').forEach(paragraph => {
        if (tag !== 'textarea') { lines.push(paragraph); return; }
        let row = ''; for (const character of paragraph) {
          if (row && context.measureText(row + character).width > available) { lines.push(row); row = ''; }
          row += character;
        } lines.push(row);
      });
      const y = tag === 'textarea' ? top : box.y + (box.height - fontSize * 1.2) / 2;
      lines.forEach((line, index) => group.appendChild(make('text', { id: `${name}-value-${index}`, x: number(x), y: number(y + index * lineHeight), ...textAttributes(style), fill: color }, line)));
    }
    function paintSVG(element, group, box, name) {
      const clone = element.cloneNode(true);
      clone.setAttribute('id', name + '-vector');
      clone.setAttribute('x', number(box.x)); clone.setAttribute('y', number(box.y));
      clone.setAttribute('width', number(box.width)); clone.setAttribute('height', number(box.height));
      clone.removeAttribute('class'); clone.removeAttribute('style');
      const originals = [element, ...element.querySelectorAll('*')];
      const clones = [clone, ...clone.querySelectorAll('*')];
      const keys = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'font-family', 'font-size', 'font-weight'];
      originals.forEach((original, index) => {
        const output = clones[index], computed = getComputedStyle(original);
        output.removeAttribute('class'); output.removeAttribute('style');
        if (index) output.setAttribute('id', `${name}-vector-${index}`);
        keys.forEach(key => { const value = computed.getPropertyValue(key); if (value) output.setAttribute(key, value === 'currentcolor' ? computed.color : value); });
      });
      // Lucide has no internal references. Preserve and namespace any custom SVG ids.
      const ids = new Map();
      element.querySelectorAll('[id]').forEach((original, index) => ids.set(original.id, `${name}-reference-${index}`));
      originals.forEach((original, index) => {
        if (index && ids.has(original.id)) clones[index].setAttribute('id', ids.get(original.id));
        Array.from(clones[index].attributes).forEach(attribute => {
          let value = attribute.value;
          ids.forEach((replacement, id) => { value = value.replaceAll(`url(#${id})`, `url(#${replacement})`); if (value === `#${id}`) value = `#${replacement}`; });
          if (value !== attribute.value) clones[index].setAttribute(attribute.name, value);
        });
      });
      group.appendChild(clone);
    }
    function walk(element, destination) {
      const tag = element.tagName.toLowerCase();
      if (['script', 'style', 'link', 'meta', 'noscript', 'template'].includes(tag)) return;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) return;
      const box = relativeBox(element.getBoundingClientRect());
      const hasBox = box.width > 0 && box.height > 0;
      if (hasBox && !isOnScreen(box, frame)) return;
      const name = layerName(element);
      const group = make('g', { id: name, 'data-element': tag, opacity: style.opacity !== '1' ? style.opacity : null });
      destination.appendChild(group);
      if (hasBox) paintBox(group, element, box, style, name);
      if (tag === 'svg') { if (hasBox) paintSVG(element, group, box, name); return; }
      if (tag === 'img') {
        const source = element.currentSrc || element.src;
        if (hasBox && source?.startsWith('data:')) group.appendChild(make('image', {
          id: name + '-original-image', x: number(box.x), y: number(box.y), width: number(box.width), height: number(box.height), href: source,
          preserveAspectRatio: style.objectFit === 'cover' ? 'xMidYMid slice' : style.objectFit === 'fill' ? 'none' : 'xMidYMid meet',
          'clip-path': clipFor(box, style, name + '-original-image')
        }));
        return;
      }
      let children = group;
      if (hasBox && (/hidden|clip|auto|scroll/.test(style.overflowX) || /hidden|clip|auto|scroll/.test(style.overflowY))) {
        children = make('g', { id: name + '-visible-content', 'clip-path': clipFor(box, style, name + '-content') }); group.appendChild(children);
      }
      if (['input', 'textarea', 'select'].includes(tag)) { paintControl(element, children, box, style, name); return; }
      Array.from(element.childNodes).forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) walk(child, children);
        else if (child.nodeType === Node.TEXT_NODE) paintText(child, children, element, style, name);
      });
    }
    const phone = make('g', { id: 'puppy-notebook-phone', 'clip-path': clipFor(frame, getComputedStyle(node), 'phone-frame') });
    svg.appendChild(phone); walk(node, phone);
    const serialized = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
    if (options.download === true) {
      const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }));
      link.href = url; link.download = /\.svg$/i.test(fileName || '') ? fileName : `${fileName || '小狗记事本'}.svg`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    return serialized;
  };
})();
