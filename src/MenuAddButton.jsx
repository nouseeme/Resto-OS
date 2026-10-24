import React, { useEffect, useRef, useState } from 'react';
import { Check, Plus } from 'lucide-react';

export default function MenuAddButton({ item, quantity, onAdd }) {
  const [added, setAdded] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const atLimit = quantity >= 30;

  function add(event) {
    onAdd(item, event.detail === 0 ? null : event.currentTarget);
    setAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1400);
  }

  return <button type="button" className="button dish-add" data-added={added}
    aria-label={atLimit ? `Maksimal 30 porsi ${item.name}` : `Tambah ${item.name}`}
    disabled={!item.available || atLimit} onClick={add}>
    {item.available && <span className="add-symbol" aria-hidden="true">
      <span className="add-plus"><Plus size={16}/></span>
      <span className="add-check"><Check size={16}/></span>
    </span>}
    <span className="add-label">
      <span className="add-label-idle" aria-hidden={added}>{item.available ? (atLimit ? 'Maks. 30' : 'Tambah') : 'Habis'}</span>
      <span className="add-label-done" aria-hidden={!added}>Ditambah</span>
    </span>
  </button>;
}
