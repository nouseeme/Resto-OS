export function popularMenu(menu, orders) {
  const counts=new Map();
  for(const order of orders) for(const unit of order.units) {
    if(unit.status==='cancelled'||unit.cancelled)continue;
    const row=counts.get(unit.menuId)??{menuId:unit.menuId,name:unit.name,quantity:0};
    row.quantity++;counts.set(unit.menuId,row);
  }
  return [...counts.values()].map(row=>({...menu.find(m=>m.id===row.menuId),...row,id:row.menuId})).sort((a,b)=>b.quantity-a.quantity||a.name.localeCompare(b.name,'id'));
}
export function kitchenDemand(orders) {
  const counts=new Map();
  for(const order of orders) for(const unit of order.units) {
    if(!['waiting','accepted','cooking'].includes(unit.status))continue;
    const row=counts.get(unit.menuId)??{menuId:unit.menuId,name:unit.name,waiting:0,accepted:0,cooking:0,total:0};
    row[unit.status]++;row.total++;counts.set(unit.menuId,row);
  }
  return [...counts.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'id'));
}
