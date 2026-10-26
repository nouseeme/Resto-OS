// First entry alerts only unconfirmed orders; subsequent snapshots alert new IDs,
// regardless of whether auto-accept happened between polls. Status changes never alert.
export function kitchenArrivals(orders, seen) {
  return orders.filter(order => seen
    ? !seen.has(order.id) && order.units.some(unit => ['waiting', 'accepted', 'cooking'].includes(unit.status))
    : order.units.some(unit => ['waiting', 'accepted'].includes(unit.status))).map(order => order.id);
}
