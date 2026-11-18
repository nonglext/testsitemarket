export function table(columns, rows) {
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const name of columns) {
    const cell = document.createElement('th');
    cell.textContent = name;
    head.append(cell);
  }
  const body = table.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const value of values) {
      const cell = row.insertCell();
      if (value instanceof Node) cell.append(value);
      else cell.textContent = value ?? '';
    }
  }
  if (!rows.length) {
    const cell = body.insertRow().insertCell();
    cell.colSpan = columns.length;
    cell.className = 'muted';
    cell.textContent = 'Здесь пока ничего нет';
  }
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap card';
  wrap.append(table);
  return wrap;
}
