import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
// jsPDF is imported inside handlePdfExport, not here — keeps it off every page load.
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarQuickFilter,
  GridToolbarColumnsButton,
  GridToolbarDensitySelector,
  GridColumnMenuContainer,
  GridColumnMenuSortItem,
  GridColumnMenuColumnsItem,
  GridFilterListIcon,
  useGridApiContext,
  useGridSelector,
  gridSortModelSelector,
  gridVisibleColumnDefinitionsSelector,
  gridDensityFactorSelector,
} from '@mui/x-data-grid';
import { IconButton, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const PAGE_SIZES = [10, 25, 50, 100];
const ACTION_LABELS = ['ACTION', 'DELETE', 'VIEW', 'EDIT'];

const gridTheme = createTheme({
  palette: { primary: { main: '#3482AE' } },
  typography: { fontFamily: 'Exo, sans-serif' },
  zIndex: { modal: 10000, tooltip: 10001 },
});

const GridUICtx = createContext({});

function GridToolbarNoExport() {
  const { isFullscreen, toggleFullscreen, filtersVisible, toggleFilters, hasActiveFilters, hasQuickFilterText, clearFilters, reportDensityFactor } = useContext(GridUICtx);
  // Open width — applied on focus, and while the box holds text.
  const searchOpen = { width: { xs: 160, sm: 220 } };
  const showCross = filtersVisible || hasActiveFilters;
  const apiRef = useGridApiContext();
  const densityFactor = useGridSelector(apiRef, gridDensityFactorSelector);
  useEffect(() => { reportDensityFactor?.(densityFactor); }, [densityFactor, reportDensityFactor]);
  return (
    <GridToolbarContainer
      sx={{
        justifyContent: 'flex-end',
        gap: { xs: 0.125, sm: 0.5 },
        p: 0.5,
        '& .MuiButton-root': { fontSize: 0, minWidth: 0, p: '6px', color: '#6b7280' },
        '& .MuiButton-startIcon': { m: 0 },
        '& .MuiButton-startIcon > svg, & .MuiButton-endIcon > svg': { fontSize: 20 },
        '& .MuiIconButton-root': { color: '#6b7280' },
        '& .MuiSvgIcon-root': { color: '#6b7280' },
      }}
    >
      <GridToolbarQuickFilter
        sx={{
          width: 34,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
          ...(hasQuickFilterText ? searchOpen : {}),
          '&:focus-within': searchOpen,
          '& .MuiInput-underline:before': {
            borderBottomColor: hasQuickFilterText ? 'rgba(0,0,0,0.42)' : 'transparent',
          },
          '&:focus-within .MuiInput-underline:before': { borderBottomColor: 'rgba(0,0,0,0.42)' },
          '& .MuiInputBase-root': { minHeight: 30, paddingTop: 0, paddingBottom: 0, width: '100%' },
          '& .MuiInputAdornment-root': { marginRight: hasQuickFilterText ? '8px' : 0 },
          '&:focus-within .MuiInputAdornment-root': { marginRight: '8px' },
          '& .MuiInputBase-input': { paddingTop: '3px', paddingBottom: '3px', fontSize: 13, textTransform: 'uppercase !important' },
          '& input::placeholder': { textTransform: 'uppercase !important', fontSize: 12, opacity: 0.7 },
        }}
      />
      <IconButton
        size="small"
        onClick={hasActiveFilters ? clearFilters : toggleFilters}
        title={hasActiveFilters ? 'Clear filters' : 'Filters'}
        sx={{
          position: 'relative',
          ...(filtersVisible ? { backgroundColor: '#eaf2f8' } : {}),
        }}
      >
        <GridFilterListIcon sx={{ fontSize: 20, color: showCross ? '#3482AE' : '#6b7280' }} />
        {showCross && (
          <span
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 22,
              height: 2,
              backgroundColor: '#6b7280',
              transform: 'translate(-50%, -50%) rotate(-45deg)',
              transformOrigin: 'center',
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}
      </IconButton>
      <GridToolbarColumnsButton />
      <GridToolbarDensitySelector />
      <IconButton size="small" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
        <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} style={{ fontSize: 15, color: '#6b7280' }} />
      </IconButton>
    </GridToolbarContainer>
  );
}

function SortIcon({ field }) {
  const apiRef = useGridApiContext();
  const sortModel = useGridSelector(apiRef, gridSortModelSelector);
  const dir = sortModel.find((s) => s.field === field)?.sort ?? null;
  const sort = (target) => (event) => {
    event.stopPropagation();
    apiRef.current.sortColumn(field, dir === target ? null : target);
  };
  const DARK = '#ffffff';
  const FAINT = 'rgba(255,255,255,0.55)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <i
        className="fas fa-long-arrow-alt-up"
        onClick={sort('asc')}
        title="Sort ascending"
        style={{ fontSize: 8, cursor: 'pointer', color: dir === 'asc' ? DARK : FAINT, marginRight: 1 }}
      />
      <i
        className="fas fa-long-arrow-alt-down"
        onClick={sort('desc')}
        title="Sort descending"
        style={{ fontSize: 8, cursor: 'pointer', color: dir === 'desc' ? DARK : FAINT }}
      />
    </span>
  );
}

function ColumnHeader({ label, field, filterable, sortable }) {
  const { filtersVisible, getColFilter, setColFilter } = useContext(GridUICtx);
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}>
        <span
          className="dt-col-label"
          style={{ fontWeight: 600, color: '#ffffff', fontSize: 13, lineHeight: 1.2, whiteSpace: 'nowrap' }}
        >
          {label}
        </span>
        {sortable && <SortIcon field={field} />}
      </span>
      {filtersVisible && filterable && (
        <input
          className="dt-col-filter"
          value={getColFilter(field)}
          onChange={(e) => setColFilter(field, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={`Filter by ${label}`}
          style={{
            font: 'inherit', fontSize: 11, fontWeight: 400, padding: '2px 0',
            border: 'none', borderBottom: '1.5px solid rgba(255,255,255,0.6)', borderRadius: 0,
            outline: 'none', width: '100%', background: 'transparent', color: '#ffffff',
          }}
        />
      )}
    </div>
  );
}

function CustomColumnMenu(props) {
  const { revealFilters } = useContext(GridUICtx);
  const filterable = props.colDef?.filterable !== false;
  return (
    <GridColumnMenuContainer {...props}>
      <GridColumnMenuSortItem {...props} onClick={props.hideMenu} />
      {filterable && (
        <MenuItem onClick={(event) => { revealFilters?.(); props.hideMenu?.(event); }}>
          <ListItemIcon><GridFilterListIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Filter</ListItemText>
        </MenuItem>
      )}
      <GridColumnMenuColumnsItem {...props} onClick={props.hideMenu} />
    </GridColumnMenuContainer>
  );
}

// Placeholder rows shown while the list is still on its way. Keeps the grid's
// shape on screen instead of an empty table reading "NO RECORDS FOUND".
const SKELETON_ROWS = 8;
function GridLoadingSkeleton() {
  const apiRef = useGridApiContext();
  const columns = useGridSelector(apiRef, gridVisibleColumnDefinitionsSelector);
  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#fff', zIndex: 5 }}>
      {Array.from({ length: SKELETON_ROWS }).map((_, r) => (
        <div key={r} style={{ display: 'flex', width: '100%', height: 52, alignItems: 'center', borderBottom: '1px solid #f1f3f5' }}>
          {columns.map((col) => (
            <div
              key={col.field}
              style={{
                flex: col.flex ? `${col.flex} 1 0` : `0 0 ${col.computedWidth || col.width || 110}px`,
                minWidth: col.minWidth || 0,
                padding: '0 16px',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: '70%', height: 12, borderRadius: 6, backgroundColor: '#e9edf0' }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function DataTable({ columns = [], data = [], reportTitle = 'Report', loading = false }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filterModel, setFilterModel] = useState({ items: [] });
  const [densityFactor, setDensityFactor] = useState(1);
  const [printStamp, setPrintStamp] = useState('');
  const wrapRef = useRef(null);
  const toggleFullscreen = () => setIsFullscreen((f) => !f);
  const toggleFilters = () => setFiltersVisible((v) => !v);
  const getColFilter = (field) => filterModel.items.find((it) => it.field === field)?.value ?? '';
  const setColFilter = (field, value) =>
    setFilterModel((prev) => {
      const items = prev.items.filter((it) => it.field !== field);
      if (value) items.push({ field, operator: 'contains', value, id: field });
      return { ...prev, items };
    });
  // Keeps the search box open once focus moves away.
  const hasQuickFilterText =
    filterModel.quickFilterValues?.some((v) => v != null && v !== '') ?? false;
  // Column filters only — the search box must not light up the filter icon.
  const hasActiveFilters =
    filterModel.items.some((it) => it.value != null && it.value !== '');
  // Clears the column filters only — the search box keeps its text.
  const clearFilters = () =>
    setFilterModel((prev) => ({ items: [], quickFilterValues: prev.quickFilterValues ?? [] }));
  useEffect(() => {
    if (!isFullscreen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  function getCellValue(row, col, rowIndex) {
    if (col.key === 'compSrNo') return row.compSrNo || '-';
    if (col.key === 'status') {
      const statusMap = {
        0: 'Submission Pending', 1: 'Approved', 2: 'Rejected', 3: 'Submitted',
        4: 'Approval Pending', 5: 'Pending', 6: 'Compliance Assigned',
        11: 'Approval Pending', 22: 'Final Approval Pending', [-2]: 'Rejected',
      };
      return statusMap[row.status] ?? String(row.status ?? '-');
    }
    if (col.key === 'dueDate') {
      if (row.compFrequency === 'AS & WHEN') return row.lastDueDate || '-';
      return row.firstDueDate || '-';
    }
    if (col.key === 'deptDetails') return row.deptDetails?.deptName || '-';

    const labelUpper = String(col.label || '').toUpperCase();
    if (
      (labelUpper.includes('SR.NO') || labelUpper.includes('SR. NO') || labelUpper.includes('SR NO')) &&
      !labelUpper.includes('COMPLIANCE')
    ) {
      return String(rowIndex + 1);
    }

    if (col.render && !col.key) {
      try {
        const val = col.render(row, rowIndex);
        if (typeof val === 'string' || typeof val === 'number') return String(val);
      } catch { /* empty */ }
      return '';
    }

    if (col.key) {
      const item = row[col.key];
      if (item && typeof item === 'object') return item.deptName || item.plantName || item.name || '';
      return item ?? '';
    }
    return '';
  }

  const rows = data.map((row, i) => ({ __idx: i, ...row, id: row.id ?? i }));

  const fieldToCol = {};
  columns.forEach((col, ci) => {
    fieldToCol[col.key ? String(col.key) : `__c${ci}`] = col;
  });

  const activeColItems = filterModel.items.filter((it) => it.value != null && it.value !== '');
  const filteredRows =
    activeColItems.length === 0
      ? rows
      : rows.filter((row) =>
          activeColItems.every((it) => {
            const col = fieldToCol[it.field];
            if (!col) return true;
            const cell = String(getCellValue(row, col, row.__idx) ?? '').toLowerCase();
            return cell.includes(String(it.value).toLowerCase());
          }),
        );

  const muiColumns = columns.map((col, ci) => {
    const hasKey = Boolean(col.key);
    const isAction = ACTION_LABELS.includes(String(col.label || '').trim().toUpperCase());
    const field = hasKey ? String(col.key) : `__c${ci}`;
    const filterable = hasKey && col.filterable !== false && !isAction;
    const def = {
      field,
      headerName: col.label || '',
      headerAlign: 'center',
      align: 'center',
      sortable: hasKey && !isAction,
      filterable,
      disableColumnMenu: !hasKey || isAction,
      valueGetter: (_value, row) => getCellValue(row, col, row.__idx),
      renderHeader: () => <ColumnHeader label={col.label || ''} field={field} filterable={filterable} sortable={hasKey && !isAction} />,
    };
    if (col.width) {
      // Opt-in fixed width from the caller; wins over the Action default.
      // Columns without it behave exactly as before.
      def.width = col.width;
    } else if (isAction) {
      def.width = 90;
    } else {
      def.flex = 1;
      def.minWidth = Math.max(120, (col.label?.length || 8) * 8 + 40 + 30);
      if (col.key === 'status') def.minWidth = Math.max(def.minWidth, 200);
      if (col.key === 'compSrNo') def.minWidth = Math.max(def.minWidth, 170);
    }
    if (col.render) {
      def.renderCell = (params) => {
        let idx = params.row.__idx ?? 0;
        try {
          const ids = params.api.getSortedRowIds();
          const pos = ids.indexOf(params.id);
          if (pos >= 0) idx = pos;
        } catch { /* empty */ }
        return col.render(params.row, idx);
      };
    }
    return def;
  });

  const exportableCols = columns.filter((c) => {
    const lbl = String(c.label || '').trim().toUpperCase();
    return !ACTION_LABELS.includes(lbl) && c.label;
  });

  function handlePrint() {
    const now = new Date();
    setPrintStamp(`${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  }
  useEffect(() => {
    if (!printStamp) return undefined;
    window.print();
    const t = setTimeout(() => setPrintStamp(''), 0);
    return () => clearTimeout(t);
  }, [printStamp]);


  function handleExcelExport() {
    const headers = exportableCols.map((c) => c.label);
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Compliance Report</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; }
          th { background-color: #3482AE !important; color: #ffffff !important; font-weight: bold !important; border: 1px solid #000 !important; padding: 8px 12px !important; text-align: center !important; text-transform: uppercase !important; }
          td { border: 1px solid #ccc !important; padding: 8px 12px !important; text-align: center !important; }
          .last-row td { border-bottom: 3px double #000 !important; }
        </style>
      </head>
      <body>
        <table>
          <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${data.map((row, rowIndex) => {
              const isLast = rowIndex === data.length - 1;
              return `<tr class="${isLast ? 'last-row' : ''}">${exportableCols.map((col) => `<td>${getCellValue(row, col, rowIndex)}</td>`).join('')}</tr>`;
            }).join('')}
          </tbody>
        </table>
      </body>
      </html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.toLowerCase().replace(/\s+/g, '_')}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handlePdfExport() {
    // Loaded on first click only.
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF('landscape');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(reportTitle, 14, 15);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 22);

    const headers = exportableCols.map((c) => c.label);
    const body = data.map((row, rowIndex) => exportableCols.map((col) => getCellValue(row, col, rowIndex)));
    autoTable(doc, {
      head: [headers],
      body,
      startY: 28,
      styles: { fontSize: 8, font: 'Helvetica' },
      headStyles: { fillColor: [52, 130, 174], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 30, right: 14, bottom: 15, left: 14 },
      didDrawPage: function () {
        const str = 'Page ' + doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        const size = doc.internal.pageSize;
        const pageHeight = size.height ? size.height : size.getHeight();
        const pageWidth = size.width ? size.width : size.getWidth();
        doc.text(str, pageWidth - 20, pageHeight - 8);
      },
    });
    doc.save(`${reportTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`);
  }

  const exportBtnCls =
    'px-4 py-1.5 bg-[#3482AE] hover:bg-[#2A6B91] text-white text-[11px] uppercase rounded-sm border-0 cursor-pointer transition-colors flex items-center gap-1.5';

  const gridBlock = (
        <div
          ref={wrapRef}
          className={`no-print bg-white border border-gray-200 shadow-sm ${
            isFullscreen ? 'fixed inset-0 z-[9998] rounded-none overflow-hidden p-2 flex flex-col' : 'rounded-lg'
          }`}
        >
          <DataGrid
            rows={loading ? [] : filteredRows}
            columns={muiColumns}
            loading={loading}
            showToolbar
            filterModel={{ items: [], quickFilterValues: filterModel.quickFilterValues ?? [] }}
            onFilterModelChange={(m) =>
              setFilterModel((prev) => ({ ...prev, quickFilterValues: m.quickFilterValues ?? [] }))
            }
            columnHeaderHeight={Math.round((filtersVisible ? 72 : 40) / densityFactor)}
            slots={{ toolbar: GridToolbarNoExport, columnMenu: CustomColumnMenu, loadingOverlay: GridLoadingSkeleton }}
            autoHeight={!isFullscreen}
            disableRowSelectionOnClick
            pageSizeOptions={PAGE_SIZES}
            initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
            localeText={{ noRowsLabel: 'NO RECORDS FOUND', noResultsOverlayLabel: 'NO RESULTS FOUND' }}
            sx={{
              border: 'none',
              fontSize: '13px',
              ...(isFullscreen ? { flex: 1, minHeight: 0 } : {}),
              ...(loading ? { '--DataGrid-overlayHeight': `${SKELETON_ROWS * 45}px` } : {}),
              '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader': { backgroundColor: '#3482AE' },
              '& .dt-col-filter::placeholder': { color: 'rgba(255,255,255,0.7)', opacity: 1 },
              '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600, color: '#ffffff' },
              '& .MuiDataGrid-columnSeparator': { color: 'rgba(255,255,255,0.4)' },
              '& .MuiDataGrid-menuIcon .MuiSvgIcon-root, & .MuiDataGrid-menuIconButton': { color: '#ffffff' },
              '& .MuiDataGrid-columnHeaderTitleContainer, & .MuiDataGrid-columnHeaderTitleContainerContent': {
                overflow: 'visible',
              },
              '& .MuiDataGrid-menuIcon': { visibility: 'visible', width: 'auto', opacity: 1 },
              '& .MuiDataGrid-iconButtonContainer': { display: 'none' },
              '& .MuiTablePagination-root, & .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows, & .MuiTablePagination-select, & .MuiTablePagination-input': {
                fontSize: '13px',
              },

              '& .MuiTablePagination-selectLabel': { display: 'block', marginRight: { xs: '2px', sm: 0 } },
              '& .MuiTablePagination-toolbar': { paddingLeft: { xs: '4px', sm: undefined } },
              '& .MuiTablePagination-input': {
                display: 'inline-flex',
                marginRight: { xs: '4px', sm: '32px' },
                marginLeft: { xs: '2px', sm: '8px' },
              },
              '& .MuiTablePagination-actions': { marginLeft: { xs: '6px', sm: '20px' } },
              '& .MuiDataGrid-cell': { color: '#374151' },
              '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
              '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': { outline: 'none' },
            }}
          />
        </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 no-print">
        <button type="button" onClick={handleExcelExport} className={exportBtnCls}>
          <i className="fas fa-file-excel" /> Excel
        </button>
        <button type="button" onClick={handlePdfExport} className={exportBtnCls}>
          <i className="fas fa-file-pdf" /> PDF
        </button>
        <button type="button" onClick={handlePrint} className={exportBtnCls}>
          <i className="fas fa-print" /> Print
        </button>
      </div>

      <ThemeProvider theme={gridTheme}>
       <GridUICtx.Provider
         value={{ isFullscreen, toggleFullscreen, filtersVisible, toggleFilters, hasActiveFilters, hasQuickFilterText, clearFilters, reportDensityFactor: setDensityFactor, revealFilters: () => setFiltersVisible(true), getColFilter, setColFilter }}
       >
        {isFullscreen ? createPortal(gridBlock, document.body) : gridBlock}
       </GridUICtx.Provider>
      </ThemeProvider>

      <div className="print-table-container">
        {printStamp && <div className="print-only-meta" style={{ display: 'none' }}>Generated on: {printStamp}</div>}
        <table className="data-table w-full">
          <thead>
            <tr>
              {exportableCols.map((col) => (
                <th key={col.key || col.label}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={exportableCols.length}>No records found</td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={row.id ?? rowIndex}>
                  {exportableCols.map((col) => (
                    <td key={col.key || col.label}>{getCellValue(row, col, rowIndex)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
