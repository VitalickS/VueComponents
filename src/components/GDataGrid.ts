import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { LayoutApi, IHeaderModel, FilterConditions, JsonGridLayout, ILayout, IExportDataParameters, IHeaderType } from './LayoutApi';
import { LocalStorageLayoutApi } from './LocalStorageLayoutApi';

@Component({})
export default class GDataGridClass extends Vue {

    /** Properties */

    @Prop({ required: true })
    public tableId!: string;

    @Prop({ required: true })
    public trackId!: string;

    @Prop({ default: () => [] })
    public items!: any[];

    @Prop({ default: () => null })
    public calcRowHeight!: (r: any, expand: boolean) => number;

    @Prop({ default: 'Items', type: String })
    public toolbarName!: string;

    @Prop({ default: 200, type: Number })
    public height!: number;

    @Prop({ default: () => (new LocalStorageLayoutApi()) })
    public layoutApi!: LayoutApi;

    @Prop({ default: () => ([]) })
    public headers!: IHeaderModel[];

    @Prop({ default: 25 })
    public rowHeight!: number;

    @Prop({ default: 200 })
    public itemsBefore!: number;

    @Prop({ default: 300 })
    public itemsAfter!: number;

    @Prop({ default: 200 })
    public colSpaceBefore!: number;

    @Prop({ default: 400 })
    public colSpaceAfter!: number;

    @Prop({ default: false, type: Boolean })
    public filterRow!: boolean;

    @Prop({ default: false, type: Boolean })
    public singleSorting!: boolean;

    @Prop({ default: false, type: Boolean })
    public loading!: boolean;

    @Prop({ default: `No data for specified filters. Check filters' conditions.` })
    public noDataForFilter!: string;

    @Prop({ default: `Loading... Please wait` })
    public noData!: string;

    @Prop({ default: true, type: Boolean })
    public multipleSelection!: boolean;

    @Prop({ default: 0 })
    public animationOpacityDuration!: number;

    @Prop({
        default: () => ({
            default: 'yellow',
            delete: 'red',
            deleteColor: 'white',
            add: 'green',
            addColor: 'white',
        }),
    })
    public colorScheme!: Record<string, string>;

    @Prop({ default: 1000 })
    public highlightDuration!: number;

    @Prop({ default: 1000 })
    public doubleClickDuration!: number;
    @Prop()
    public selectedItem!: any;

    @Prop({ default: () => (new Set<any>()) })
    public selectedItems!: Set<any>;

    @Prop({ default: () => ([]), type: Array })
    public systemColumns!: string[];

    @Prop({ default: '' })
    public undefinedText!: string;

    @Prop({ default: true, type: Boolean })
    public exportUseServer!: boolean;

    @Prop({ default: true, type: Boolean })
    public hasDefaultValueFormatOption!: boolean;

    /** Fields */

    public loadingInternal = false;
    public filteredItems: any[] = [];
    public quickSearch = '';
    public useDefaultValueFormat = false;

    public sortColumns: string[] = [];

    public visibleItems: any[] = [];
    public visibleHeaders: IHeaderModel[] = [];
    public top = 0;
    public left = 0;
    public beginIdx = 0;

    public lastSelectedItem: any = {};
    public lastSelectedItemTime?: Date;
    public containerHeight = 0;
    public containerWidth = 0;
    public colOffset = 0;
    public globalFormat: (v: any) => any = this.defaultGlobalFormat;

    /** Private Fields */

    private tab = '1';
    private menuX = 0;
    private menuY = 0;
    private menuOffsetX = 0;
    private menuOffsetY = 0;
    private menu = false;
    private scrollTimeoutId?: number;
    private resizingHeader?: any;
    private previousClientX?: number;
    private filters: Record<string, string> = {};
    private filterConditions: Record<string, FilterConditions> = {};
    private tempFilters: Record<string, string> = {};
    private tempTexts: Record<string, string> = {};
    private syncTimeoutId = 0;
    private tableMenu = false;
    private filterMenu = false;
    private filterMenuModel: IHeaderModel = { value: '', width: 0 };
    private colValues: Record<string, any[]> = {};
    private visualStates: Record<any, { hightlight: string, color: string, status?: string }> = {};
    private draggingheader?: IHeaderModel;
    private visualRowsChangedCount = 0;
    private switchingMode = false;

    private layouts: JsonGridLayout[] = [];
    private currentLayoutName = '';
    private renamingStage = false;
    private headersInternal: IHeaderModel[] = [];
    private rowOffsets: number[] = [];
    private rowExpanded: Record<any, boolean> = {};

    /** Getters (computed) */

    public get storageId() {
        return 'gtable-layout-' + this.tableId;
    }

    public get layout() {
        return this.layouts.find((l) => l.layoutName === this.currentLayoutName);
    }

    public get conditions() {
        return [
            'Contains',
            'Equals',
            'Starts With',
            'Ends With',
            'Not Equal',
            'Greater Than',
            'Less Than',
            'In',
        ] as FilterConditions[];
    }

    public get conditionsShort() {
        return [
            '*',
            '=',
            '[...',
            '...]',
            '<>',
            '>=',
            '=<',
            'IN',
        ] as string[];
    }

    public get layoutObject(): ILayout {
        return JSON.parse(JSON.stringify({
            headers: this.headersInternal,
            filters: this.filters,
            sortColumns: this.sortColumns,
            quickSearch: this.quickSearch,
            filterConditions: this.filterConditions,
        }));
    }

    public set layoutObject(value: ILayout) {
        this.filters = value.filters;
        this.sortColumns = value.sortColumns;
        this.quickSearch = value.quickSearch ?? '';
        this.filterConditions = value.filterConditions ?? {};
        this.headersInternal = value.headers;
        this.$emit('update:headers', value.headers);
        this.syncFilteredItems();
        this.updateVisibleHeaders();

    }

    /** Public functions */
    public exportSelected() {
        if (!this.exportUseServer) {
            this.fnExcelReport(this.filteredItems);
        } else {
            this.$emit('export', {
                name: this.$route.name ?? '',
                rows: new Array(...this.selectedItems.values()).map((v) => {
                    const exportrow = Object.assign({}, v);
                    if (this.useDefaultValueFormat) {
                        this.visibleHeaders.forEach((h) => {
                            exportrow[h.value] = this.getCellValue(exportrow, h);
                        });
                    }
                    return exportrow;
                }),
                headers: this.visibleHeaders
                    .map((h) => ({
                        format: h.format,
                        text: h.text,
                        value: h.value,
                        width: Math.round(h.width),
                    }) as IHeaderType),
            } as IExportDataParameters);
        }
    }

    public exportAll() {
        if (!this.exportUseServer) {
            this.fnExcelReport(this.items);
        } else {
            this.$emit('export', {
                name: this.$route.name ?? '',
                rows: new Array(...this.selectedItems.values()).map((v) => {
                    const exportrow = Object.assign({}, v);
                    if (this.useDefaultValueFormat) {
                        this.visibleHeaders.forEach((h) => {
                            exportrow[h.value] = this.getCellValue(exportrow, h);
                        });
                    }
                    return exportrow;
                }),
                headers: this.visibleHeaders
                    .map((h) => ({
                        format: h.format,
                        text: h.text,
                        value: h.value,
                        width: Math.round(h.width),
                    }) as IHeaderType),
            } as IExportDataParameters);
        }
    }


    public widthNumber(w: any): number {
        if (typeof w === 'number') {
            return w;
        }
        if (w === 'NaN' || isNaN(w)) {
            return 80;
        }
        if (!w || w < 5) {
            return 5;
        }
        return 0;
    }

    public nWidth(w: any) {
        return this.widthNumber(w) + 'px';
    }

    public defaultGlobalFormat(v: any) {
        if (v instanceof Date) {
            return v.toLocaleString().replace('T00:00:00', '').replace('T', ' ').replace('Z', '');
        } else if (typeof v === 'string' && v.endsWith('T00:00:00')) {
            return v.substr(0, v.length - 9);
        }
        return v;
    }

    public formatUsingHeaderFormat(v: any, format: string) {
        // TODO
        return v;
    }

    public getCellValue(row: any, header: IHeaderModel) {
        const cv = this.globalFormat(header.format ?
            this.formatUsingHeaderFormat(row[header.value], header.format) :
            row[header.value]);
        if (cv === undefined) {
            return this.undefinedText;
        } else if (typeof cv === 'boolean') {
            return cv ? '✅' : '❌';
        } else if (typeof cv === 'string' && (cv === 'Y' || cv === 'N') &&
            ((header.value).startsWith('is')
                || header.value.endsWith('Flag')
                || header.value.endsWith('Status'))) {
            return cv === 'Y' ? '✅' : '❌';
        }
        return cv;
    }

    public qsLeft(cellVal: any) {
        const idx = cellVal?.toString().indexOf(this.quickSearch);
        if (idx >= 0) {
            return cellVal.toString().substr(0, idx);
        }
        return cellVal;
    }

    public qsRight(cellVal: any) {
        const idx = cellVal?.toString().indexOf(this.quickSearch);
        if (idx >= 0) {
            return cellVal.toString().substr(idx + this.quickSearch.length);
        }
        return '';
    }

    public qsHighlight(cellVal: any) {
        const idx = cellVal?.toString().indexOf(this.quickSearch);
        if (idx >= 0) {
            return this.quickSearch;
        }
        return '';
    }

    public getCellValue_Old(row: any, header: any) {
        const cv = this.globalFormat(header.format ? header.format(row[header.value], row) : row[header.value]);
        if (cv === undefined) {
            return this.undefinedText;
        }
        return cv;
    }

    public getColValues(fieldName: string) {
        if (this.filterMenu) {
            const tempFilter = this.tempFilters[fieldName]?.toLowerCase();
            const filteringColl = this.filteredItems ?? this.items;
            if (tempFilter) {
                return [...new Set(filteringColl
                    .filter((i) => this.filterItem(i, [fieldName], tempFilter))
                    .map((i) => i[fieldName])).values()].sort();
            } else {
                return [...new Set(filteringColl
                    .map((i) => i[fieldName])).values()].sort();
            }
        }
        return [];
    }

    public async showRowMenu(e: MouseEvent) {
        e.preventDefault();
        this.menu = false;
        this.menuOffsetX = e.clientX;
        this.menuOffsetY = e.clientY;
        await this.$nextTick();
        this.menu = true;

    }

    public reorder(fieldName: string, delta: number) {
        let colIndex = this.headersInternal.findIndex((h) => h.value === fieldName);
        if (colIndex < 0) { return; }
        const header = this.headersInternal[colIndex];
        this.headersInternal.splice(colIndex, 1);
        colIndex += delta;
        if (colIndex < 0) {
            colIndex = 0;
        }
        if (colIndex >= this.headersInternal.length) {
            colIndex = this.headersInternal.length;
        }
        this.headersInternal.splice(colIndex, 0, header);
        this.updateVisibleHeaders();
        this.scrollIntoColumn(header.value);
    }

    public async scrollIntoColumn(colName: string) {
        await this.$nextTick();
        const ref = this.$refs[`header-${colName}`] as HTMLElement[];
        if (ref && ref[0]) {
            ref[0].scrollIntoView();
        }
    }

    public selectFilter(fieldName: string, fieldValue: any) {
        this.filters[fieldName] = fieldValue?.toString();
        this.closeFilter();
        this.syncFilteredItems();
    }

    public hasFilter(fieldName: string) {
        return this.filters[fieldName];
    }

    public closeFilter() {
        this.filterMenu = false;
        this.filterMenuModel = { value: '', width: 0 };
    }

    public beginColDrag(h: IHeaderModel, e: PointerEvent) {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        this.draggingheader = h;
        this.previousClientX = e.clientY;
    }


    public endColDrag(e: PointerEvent) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        this.filterMenuModel = this.draggingheader ?? { value: '', width: 0 };
        this.draggingheader = undefined;
    }

    public colDrag(e: PointerEvent) {
        if (this.draggingheader && this.previousClientX) {
            const delta = Math.trunc((e.clientY - this.previousClientX) / 28);
            if (Math.abs(delta) >= 1) {
                this.previousClientX += delta * 28;
                this.reorder(this.draggingheader.value, delta);
            }
        }
    }

    public applyFilter(header: IHeaderModel) {
        const fieldName = header.value;
        this.filters[fieldName] = this.tempFilters[fieldName];
        header.text = this.tempTexts[fieldName];
        this.closeFilter();
        this.syncFilteredItems();
    }

    public resetFilter(fieldName: string) {
        delete this.filters[fieldName];
        this.closeFilter();
        this.syncFilteredItems();
    }

    public selectFiltered() {
        this.selectedItems.clear();
        this.filteredItems.forEach((i) => this.selectedItems.add(i));
        this.updateVisibleItems();
    }

    public clearSelection() {
        this.selectedItems.clear();
        this.updateVisibleItems();
    }

    public selectAll() {
        if (this.selectedItems.size === this.items.length) {
            this.selectedItems.clear();
            this.updateVisibleItems();
            return;
        }
        this.selectedItems.clear();
        this.items.forEach((i) => this.selectedItems.add(i));
        this.updateVisibleItems();
    }

    public toggleSelection(row: any, e: MouseEvent) {
        function detectLeftButton(evt: (MouseEvent | MouseEventInit)) {
            evt = evt || window.event;
            if ('buttons' in evt) {
                return evt.buttons === 1;
            }
            return evt.button === 1;
        }
        if (!detectLeftButton(e) && this.lastSelectedItem === row) {
            return;
        }
        if (this.lastSelectedItem === row && this.lastSelectedItemTime) {
            // Check for doubleclick
            const diffTicks = new Date().valueOf() - this.lastSelectedItemTime.valueOf();
            if (diffTicks <= this.doubleClickDuration) {
                this.$emit('doubleclick', row, this.items);
                this.lastSelectedItemTime = undefined;
                return;
            }
        }
        if (e.shiftKey && this.multipleSelection) {
            let index = this.filteredItems.indexOf(this.lastSelectedItem);
            let nextIndex = this.filteredItems.indexOf(row);
            if (index > nextIndex) {
                [nextIndex, index] = [index, nextIndex];
            }
            for (; index <= nextIndex; index++) {
                const element = this.filteredItems[index];
                if (e.ctrlKey) {
                    this.selectedItems.delete(element);
                } else {
                    this.selectedItems.add(element);
                }
            }
            this.lastSelectedItem = row;
            this.$emit('update:selectedItem', row);
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (!this.multipleSelection) {
            this.selectedItems.clear();
        }
        if (e.ctrlKey) {
            if (!this.selectedItems.delete(row)) {
                this.selectedItems.add(row);
            }
        }
        this.lastSelectedItem = row;
        this.$emit('update:selectedItem', row);
        this.lastSelectedItemTime = new Date();
        this.$forceUpdate();
    }

    public hideAllColumns() {
        this.headersInternal.forEach((h) => h.hidden = true);
        this.updateVisibleHeaders();
    }

    public showAllColumns() {
        this.headersInternal.forEach((h) => h.hidden = false);
        this.updateVisibleHeaders();
    }

    public async toggleColumnVisible(col: IHeaderModel) {
        col.hidden = !col.hidden;
        this.updateVisibleHeaders();
        await this.$nextTick();
        (this.$refs.headerList as Vue).$forceUpdate();
    }

    public async updateVisibleHeaders() {
        const initTime = new Date().valueOf();

        this.containerWidth = 0;
        const headers = this.headersInternal.filter((h) => !h.hidden);
        headers.forEach((h) => this.containerWidth += this.widthNumber(h.width));

        // Headers

        this.visibleHeaders = [];
        this.colOffset = 0;
        let colStartIndex = 0;
        let colLength = 1;
        let colSumWidth = this.$el.clientWidth + this.colSpaceAfter + this.colSpaceBefore;
        let visiblePartStarted = false;
        headers.some((header) => {
            const nWidth = this.widthNumber(header.width);
            if (visiblePartStarted) {
                colLength++;
                colSumWidth -= nWidth;
                if (colSumWidth < 0) {
                    return true;
                }
            } else {
                if (this.colOffset + this.colSpaceBefore + nWidth > this.left) {
                    visiblePartStarted = true;
                    return;
                }
                colStartIndex++;
                this.colOffset += nWidth;
            }
        });

        const newVisibleHeaders = headers.slice(colStartIndex, colStartIndex + colLength);
        if (JSON.stringify(newVisibleHeaders) !== JSON.stringify(this.visibleHeaders)) {
            this.visibleHeaders = newVisibleHeaders;
        }

        await this.$nextTick();
        if (!Vue.config.productionTip) {
            // tslint:disable-next-line:no-console
            // console.log('updateVisibleHeaders', new Date().valueOf() - initTime);
        }
        this.loadingInternal = false;
    }

    public showMenu(h: IHeaderModel, e: MouseEvent) {
        this.menuX = Math.max(0, e.clientX - 270);
        this.menuY = e.clientY + 16;
        this.tempFilters[h.value] = this.filters[h.value];
        this.filterMenuModel = h; this.filterMenu = true;
        this.updateTempFilters(this.tempFilters[h.value], h.value);
    }

    public async updateVisibleItems(opacityAnimation = true) {
        // Recalculate container measure
        const initTime = new Date().valueOf();
        this.containerHeight = this.rowOffsets[this.rowOffsets.length - 1];

        // Init visible collections
        this.visibleItems = [];
        const beginOffset = Math.max(0, this.top - this.itemsBefore);
        this.beginIdx = this.rowOffsets.findIndex((offset) => offset >= beginOffset);
        if (this.beginIdx < 0) {
            this.beginIdx = 0;
        }

        // Items
        const endOffset = Math.min(this.containerHeight, this.top + this.$el.clientHeight + this.itemsAfter);
        let endIdx = this.rowOffsets.findIndex((offset) => offset >= endOffset);
        if (endIdx < 0) {
            endIdx = this.filteredItems.length - 1;
        }
        for (let i = this.beginIdx; i <= endIdx; i++) {
            this.visibleItems.push(this.filteredItems[i]);
        }

        // Visualization
        await this.$nextTick();
        document.querySelectorAll('.g-datatable-row').forEach((r) => {
            const row = r as HTMLDivElement;
            if (row.style.top !== row.dataset.top) {
                row.dataset.top = row.style.top;
                if (opacityAnimation && this.animationOpacityDuration > 0) {
                    row.animate([{ opacity: 0 }, { opacity: 1, offset: 1 }], {
                        duration: this.animationOpacityDuration,
                        easing: 'ease-in',
                    });
                }
            }

            if (row.dataset.rowidx) {
                const rowData = this.visibleItems[parseInt(row.dataset.rowidx, 0)];
                if (!rowData) {
                    return;
                }
                const id = rowData[this.trackId];
                const visualState = this.visualStates[id];
                if (visualState) {
                    if (visualState.status === 'del') {
                        row.animate([
                            {},
                            { background: visualState.hightlight, color: visualState.color, offset: 1 },
                        ], {
                            duration: this.highlightDuration,
                            composite: 'replace',
                        });
                    } else {
                        row.animate([
                            {},
                            { background: visualState.hightlight, color: visualState.color, offset: .7 },
                            { offset: 1 },
                        ], {
                            duration: this.highlightDuration,
                            composite: 'replace',
                        });
                    }

                    delete this.visualStates[id];
                }
            }
        });
        this.loadingInternal = false;
    }

    public beginResizeCol(header: any, e: PointerEvent) {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        this.resizingHeader = header;
        this.previousClientX = e.clientX;
    }

    public resizeCol(e: PointerEvent) {
        if (this.resizingHeader) {
            this.resizingHeader.width +=
                e.clientX - (this.previousClientX ?? e.clientX);
            this.previousClientX = e.clientX;
            if (this.resizingHeader.width < 0) {
                this.resizingHeader.width = 0;
            }
            this.$forceUpdate();
        }
    }

    public toggleHeader(headerName: string, e: MouseEvent) {
        if (this.singleSorting || !e.ctrlKey) {
            if (this.sortColumns.includes(headerName)) {
                this.sortColumns = [headerName + ' desc'];
            } else if (this.sortColumns.includes(headerName + ' desc')) {
                this.sortColumns = [];
            } else {
                this.sortColumns = [headerName];
            }
        } else {
            if (this.sortColumns.includes(headerName)) {
                const index = this.sortColumns.indexOf(headerName);
                this.sortColumns[index] = headerName + ' desc';
                this.$forceUpdate();
            } else if (this.sortColumns.includes(headerName + ' desc')) {
                const index = this.sortColumns.indexOf(headerName + ' desc');
                this.sortColumns = this.sortColumns.splice(index, 1);
            } else {
                this.sortColumns.push(headerName);
            }
        }
    }

    public endResizeCol(e: PointerEvent) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        this.resizingHeader = null;
        this.updateVisibleHeaders();
    }

    public scrolling(e: MouseEvent) {
        const t = e.target as HTMLElement;
        const vertScroll = this.top !== t.scrollTop;
        const horizScroll = this.left !== t.scrollLeft;
        if (Math.abs(t.scrollTop - this.top) > 200 ||
            Math.abs(t.scrollLeft - this.left) > 100) {
            this.loadingInternal = true;
        }
        this.top = t.scrollTop;
        this.left = t.scrollLeft;
        clearTimeout(this.scrollTimeoutId);
        this.scrollTimeoutId = setTimeout(() => {
            if (vertScroll) {
                this.updateVisibleItems();
            }
            if (horizScroll) {
                this.updateVisibleHeaders();
            }
        }, 200);
    }

    @Watch('tableId')
    public async tableIdChanged() {
        if (!this.tableId) {
            return;
        }
        this.switchingMode = true;
        this.clearSelection();
        await this.initialize();
        this.switchingMode = false;
    }

    @Watch('items', { deep: true })
    public async syncFilteredItems() {
        await this.tryCorrectHeadersIfEmpty();
        clearTimeout(this.syncTimeoutId);
        const allKeys = this.headersInternal.map((h) => h.value);
        const filterKeys = Object.keys(this.filters).filter((k) => this.filters[k]);
        const quickSearch = this.quickSearch?.toUpperCase();
        if (filterKeys.length || quickSearch) {
            this.filteredItems = this.sortItems(this.items.filter((item) => {
                const fResult = this.filterItem(item, filterKeys);
                if (!fResult) {
                    return false;
                }
                if (quickSearch) {
                    for (const key of allKeys) {
                        if (item[key]?.toString().toUpperCase().includes(quickSearch)) {
                            return true;
                        }
                    }
                    return false;
                }
                return true;
            }));
        } else {
            this.filteredItems = this.sortItems(this.items.map((i) => i));
        }
        this.recalcOffsets();
    }

    public initDefaultHeaders() {
        this.headersInternal.push(...Object.keys(this.items[0]).map((k) => ({
            value: k,
            text: this.humanize(k),
            width: 100,
            hidden: false,
        })));
    }

    public toggleExpand(row: any) {
        this.rowExpanded[row[this.trackId]] = !this.rowExpanded[row[this.trackId]];
        this.recalcOffsets();
    }

    public humanize(k: string): string {
        return k
            .replace(/^[\s_]+|[\s_]+$/g, '')
            .replace(/[_\s]+/g, ' ')
            .replace(/^[a-z]/, (m) => m.toUpperCase());
    }

    @Watch('sortColumns', { deep: true })
    public sortingChanged() {
        if (this.sortColumns.length) {
            this.filteredItems = this.sortItems(this.filteredItems);
            this.updateVisibleItems();
        } else {
            this.syncFilteredItems();
        }
    }

    public sortItems(items: any[]) {
        if (!this.sortColumns.length) {
            return items;
        }
        return items.sort((a, b) => {
            for (const sc of this.sortColumns) {
                if (sc.endsWith(' desc')) {
                    const scDesc = sc.substr(0, sc.length - 5);
                    if (a[scDesc] > b[scDesc]) {
                        return -1;
                    } else if (a[scDesc] < b[scDesc]) {
                        return 1;
                    }
                } else {
                    if (a[sc] > b[sc]) {
                        return 1;
                    } else if (a[sc] < b[sc]) {
                        return -1;
                    }
                }
            }
            return 0;
        });
    }

    public addItems(items: any[]) {
        if (!items.length) {
            return 0;
        }
        let updatedCount = 0;
        const updateItems: any[] = [];
        items.forEach((i) => {
            const id = i[this.trackId];
            const item = this.items.find((j) => j[this.trackId] === id);
            if (item) {
                updatedCount++;
                updateItems.push(item);
                this.visualStates[id] = {
                    color: this.colorScheme.defaultColor,
                    hightlight: this.colorScheme.default,
                    status: 'upd',
                };
            } else {
                this.visualStates[id] = {
                    color: this.colorScheme.addColor,
                    hightlight: this.colorScheme.add,
                    status: 'add',
                };
            }
        });

        const newItems = this.items.filter((i) => updateItems.indexOf(i) < 0);
        newItems.push(...items);
        this.$emit('update:items', newItems);
        this.visualRowsChangedCount += items.length;
        return items.length;
    }

    public deleteItems(itemKeys: any[]) {
        if (!itemKeys.length) {
            return 0;
        }
        let count = 0;
        itemKeys.forEach((key) => {
            const item = this.items.find((i) => i[this.trackId] === key);
            if (item) {
                count++;
                this.visualStates[key] = {
                    color: this.colorScheme.deleteColor,
                    hightlight: this.colorScheme.delete,
                    status: 'del',
                };
                this.selectedItems.delete(item);
            }
        });

        setTimeout(() => {
            this.$emit('update:items', this.items.filter((i) => itemKeys.indexOf(i[this.trackId]) < 0));
        }, this.highlightDuration + 50);

        this.visualRowsChangedCount += count;
        return count;
    }

    public highlightItems(items: any[]) {
        // TODO highlight means update, need update items` values
        if (!items.length) {
            return;
        }
        items.forEach((i) => {
            const id = i[this.trackId];
            this.visualStates[id] = {
                color: this.colorScheme.defaultColor,
                hightlight: this.colorScheme.default,
                status: 'upd',
            };
        });
        this.visualRowsChangedCount += items.length;
    }

    public getHeader(fieldName: string) {
        return this.headersInternal.find((h) => h.value === fieldName);
    }

    public getShortCondition(condition: FilterConditions) {
        return this.conditionsShort[this.conditions.indexOf(condition)];
    }

    public getFilterText(fieldName: string) {
        const header = this.getHeader(fieldName);
        const condition = this.filterConditions[fieldName] ?? 'Contains';
        const conditionShort = this.getShortCondition(condition);
        const filterValue = this.filters[fieldName];
        return `'${header?.text ?? header?.value}' ${conditionShort} '${filterValue}'`;
    }

    /** Save current layout with specified name */
    public async saveLayout() {
        if (this.layout) {
            await this.layoutApi.updateLayout(
                this.layout,
                this.layoutObject,
            );
        }
    }

    /** Ask user for new layout name and create new layout from current layout view */
    public async createNewLayout(newLayoutName?: string) {
        if (!newLayoutName) {
            newLayoutName = prompt('Enter new layout name') ?? undefined;
        }
        if (newLayoutName) {
            this.layouts.push(await this.layoutApi.addLayout({
                isPublic: false,
                layoutName: newLayoutName,
                tableID: this.tableId,
                gridLayoutJson: JSON.stringify(this.layoutObject),
            } as JsonGridLayout));
            this.currentLayoutName = newLayoutName;
        }
    }

    /** Delete named layout from storage */
    public async deleteLayout() {
        if (this.layout && prompt('Delete current layout? Type `yes` to confirm.') === 'yes') {
            const layoutIndex = this.layouts.findIndex((l) => l.layoutName === this.currentLayoutName);
            await this.layoutApi.deleteLayout(this.layout);
            this.currentLayoutName = this.layouts[0].layoutName ?? 'Default';
            this.layouts.splice(layoutIndex, 1);
            this.$forceUpdate();
        }
    }

    public keyToHeaderText(key: string) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()).replace('I D', 'ID');
    }
    /** Private functions */

    private async tryCorrectHeadersIfEmpty() {
        if (this.headers.length === 0 && this.items.length > 0) {
            this.headers.push(...
                Object.keys(this.items[0])
                    .filter((k) => !this.systemColumns.includes(k))
                    .map((k) => ({
                        value: k,
                        text: this.keyToHeaderText(k),
                        width: 80,
                    })));
        }
        if (!this.layouts || !this.layouts.length) {
            await this.createNewLayout('Default');
        }
    }

    private calcRowHeightDefault(row: any, expand: boolean) {
        if (expand) {
            return this.rowHeight + 100;
        }
        return this.rowHeight;
    }

    private filterItem(item: any, filterKeys: string[], filter?: any) {
        const hasCustomFilter = filter !== undefined;
        for (const key of filterKeys) {
            let filterText: any = this.filters[key];
            if (hasCustomFilter) {
                if (!isNaN(parseFloat(filter))) {
                    filterText = parseFloat(filter);
                } else {
                    filterText = filter;
                }
            }
            if (filterText === undefined || filterText === null || filterText === '') {
                continue;
            }
            const filterCondition = this.filterConditions[key] ?? '';
            if (filterText) {
                const itemValue = item[key];
                //
                switch (filterCondition) {
                    case 'Less Than':
                        if (itemValue > filterText) {
                            return false;
                        }
                        break;
                    case 'Greater Than':
                        if (itemValue < filterText) {
                            return false;
                        }
                        break;
                    case 'Not Equal':
                        if (itemValue?.toString() === filterText) {
                            return false;
                        }
                        break;
                    case 'Equals':
                        if (itemValue?.toString() !== filterText) {
                            return false;
                        }
                        break;
                    case 'Starts With':
                        if (!itemValue?.toString().startsWith(filterText)) {
                            return false;
                        }
                        break;
                    case 'Ends With':
                        if (!itemValue?.toString().endsWith(filterText)) {
                            return false;
                        }
                        break;
                    case 'Contains':
                        if (!itemValue?.toString().includes(filterText)) {
                            return false;
                        }
                        break;
                    case 'In':
                        if (!filterText.toString().split(',')
                            .map((f: string) => f.trim()).includes(itemValue?.toString() ?? '')) {
                            return false;
                        }
                        break;
                    default:
                        if (filterText[0] === '>') {
                            const num = parseFloat(filterText.substr(1));
                            if (isNaN(num)) {
                                if (filterText.substr(1) > itemValue) {
                                    return false;
                                }
                            } else {
                                if (num > itemValue) {
                                    return false;
                                }
                            }
                        } else if (filterText[0] === '<') {
                            const num = parseFloat(filterText.substr(1));
                            if (isNaN(num)) {
                                if (filterText.substr(1) < itemValue) {
                                    return false;
                                }
                            } else {
                                if (num < itemValue) {
                                    return false;
                                }
                            }
                        } else if (filterText[0] === '=') {
                            const num = parseFloat(filterText.substr(1));
                            if (isNaN(num)) {
                                // tslint:disable-next-line:triple-equals
                                if (filterText.substr(1) != itemValue) {
                                    return false;
                                }
                            } else {
                                if (num !== itemValue) {
                                    return false;
                                }
                            }
                        } else {
                            if (!itemValue?.toString().toUpperCase().includes(filterText.toString().toUpperCase())) {
                                return false;
                            }
                        }
                        break;
                }
            }
        }
        return true;
    }

    @Watch('filters', { deep: true })
    @Watch('quickSearch')
    private filtersChanged() {
        clearTimeout(this.syncTimeoutId);
        Object.keys(this.filters).forEach((f) => {
            if (this.filters[f] === '') {
                delete this.filters[f];
            }
        });
        this.syncTimeoutId = setTimeout(() => {
            this.syncFilteredItems();
        }, 2000);
    }

    @Watch('loading')
    private loadingChanged() {
        this.loadingInternal = this.loading;
    }

    @Watch('headers')
    private headersChanged() {
        this.tempTexts = {};
        this.headers.forEach((h) => { this.tempTexts[h.value] = h.text ?? h.value; });
        this.headersInternal = this.headers;
        this.updateVisibleHeaders();
    }

    @Watch('filterMenu')
    private filterMenuChanged(fieldName: string) {
        if (!this.filterMenu) {
            this.colValues[fieldName] = this.getColValues(fieldName);
            this.closeFilter();
        } else {
            this.tempTexts[fieldName] = this.headersInternal.find((h) => h.value === fieldName)?.text
                ?? this.tempTexts[fieldName];
        }
    }

    @Watch('$route')
    private async routeChanged() {
        this.left = this.top = 0;
        await this.$nextTick();
        this.updateVisibleItems(false);
    }

    @Watch('tableMenu')
    private tableMenuChanged() {
        if (this.tableMenu) {
            const hiddenColl: IHeaderModel[] = [];
            for (let index = 0; index < this.headersInternal.length; index++) {
                const header = this.headersInternal[index];
                if (!header.hidden) {
                    hiddenColl.push(header);
                    this.headersInternal.splice(index, 1);
                    index--;
                }
            }
            this.headersInternal.splice(0, 0, ...hiddenColl);
        } else if (!this.filterMenu) {
            this.closeFilter();
        }
    }

    private updateTempFilters(newValue: string, fieldName: string) {
        this.tempFilters[fieldName] = newValue;
        this.colValues[fieldName] = this.getColValues(fieldName);
        this.$forceUpdate();
    }

    private fnExcelReport(items: any[]) {
        let html = `<table><thead bgcolor="#87AFC6">`;
        this.visibleHeaders.forEach((h) => html += `<th style="width: ${this.nWidth(h.width)}">${h.text}</th>`);
        html += `</thead><tbody>`;
        items.forEach((i) => {
            html += `<tr>`;
            this.visibleHeaders.forEach((h) => html += `<td>${i[h.value]}</td>`);
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        window.open('data:application/vnd.ms-excel,' + encodeURIComponent(html));
    }

    @Watch('currentLayoutName')
    private currentLayoutNameChanged() {
        localStorage.setItem(this.storageId, this.currentLayoutName);
        if (this.renamingStage) {
            this.renamingStage = false;
            return;
        }
        const layout = this.layouts.find((l) => l.layoutName === this.currentLayoutName);
        if (layout) {
            let parsedLayout = JSON.parse(layout?.gridLayoutJson ?? '{}') as (ILayout | any[]);
            if (Array.isArray(parsedLayout)) {
                parsedLayout = Object.assign(this.layoutObject, {
                    headers: parsedLayout
                        .filter((p) => !this.systemColumns.includes(p.value))
                        .map((p) => Object.assign(p,
                            { text: p.text || this.keyToHeaderText(p.value) })),
                    filters: {},
                    sortColumns: [],
                    quickSearch: '',
                    filterConditions: {},
                });
            } else {
                parsedLayout.headers = parsedLayout.headers.filter((h) => !this.systemColumns.includes(h.value));
            }
            this.layoutObject = parsedLayout;
        }
    }

    private windowResized() {
        setTimeout(() => {
            this.$forceUpdate();
        }, 300);
    }

    private async renameLayout(newName: string) {
        if (this.layout && newName) {
            if (this.layouts.some((x) => x.layoutName === newName)) {
                return;
            }
            await this.layoutApi.renameLayout(this.layout, newName);
            this.renamingStage = true;
            this.layout.layoutName = newName;
            this.currentLayoutName = newName;
        }
    }

    private async loadLayouts() {
        try {
            this.layouts = await this.layoutApi.getLayouts(this.tableId);
        } catch {
            this.tryCorrectHeadersIfEmpty();
        }
    }


    private async mounted() {
        addEventListener('keydown', this.keydown);
        this.headersInternal = this.headers;
        this.$root.$on('gdatagrid.add', (payload: any) => {
            if (payload.id === this.tableId) {
                this.addItems(payload.items);
            }
        });
        this.$root.$on('gdatagrid.delete', (payload: any) => {
            if (payload.id === this.tableId) {
                this.deleteItems(payload.items);
            }
        });
        this.$root.$on('gdatagrid.highlight', (payload: any) => {
            if (payload.id === this.tableId) {
                this.highlightItems(payload.items);
            }
        });
        this.$root.$on('gdatagrid.invalidate', (payload: any) => {
            if (payload.id === this.tableId && this.visualRowsChangedCount) {
                this.visualRowsChangedCount = 0;
                this.updateVisibleItems();
            }
        });
        this.$on('export', async (payload: IExportDataParameters) => {
            const urlRequest = `${process.env.VUE_APP_BACKEND_URL}/api/GridLayout/ExportExcelData`;
            const fileName = 'export.xlsx';
            const response = await fetch(urlRequest,
                {
                    method: 'POST', body: JSON.stringify(payload),
                    headers: {
                        'Content-Type': 'application/json',
                        'accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    },
                },
            );
            if (response.ok) {
                const data = await response.blob();
                // const { data, fileName } = (await clientFactory.createGridLayoutApi().exportExcelData(payload));
                const url = window.URL.createObjectURL(data);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', fileName ?? 'export.xlsx');
                document.body.appendChild(link);
                link.click();
                this.tableMenu = false;
            } else {
                alert('export failed');
            }
        });

        await this.initialize();
    }
    private keydown(e: KeyboardEvent) {
        if (e.code === 'KeyA' && e.ctrlKey) {
            this.selectAll();
            e.preventDefault();
        } else if (e.code === 'KeyF' && e.ctrlKey) {
            if (document.activeElement !== this.$refs.qsinput) {
                const inputEl = this.$refs.qsinput as HTMLInputElement;
                if (inputEl) {
                    inputEl.setSelectionRange(0, inputEl.value.length);
                    inputEl.focus();
                }
                e.preventDefault();
            }
        }
    }

    private async initialize() {
        await this.loadLayouts();
        this.currentLayoutName = localStorage.getItem(this.storageId) ?? this.layouts[0].layoutName ?? 'Default';
        this.currentLayoutNameChanged();
        await this.syncFilteredItems();
        await this.updateVisibleItems(false);
        await this.updateVisibleHeaders();
        this.loadingInternal = this.loading;
    }

    private beforeDestroy() {
        removeEventListener('keydown', this.keydown);
        this.$root.$off('gdatagrid.add');
        this.$root.$off('gdatagrid.delete');
        this.$root.$off('gdatagrid.highlight');
        this.$root.$off('gdatagrid.invalidate');
    }

    private async recalcOffsets() {
        let cursor = 0;
        const c = this.calcRowHeight ?? this.calcRowHeightDefault;
        this.rowOffsets = this.filteredItems.map((row: any) => (cursor += c(row, this.rowExpanded[row[this.trackId]])));
        await this.updateVisibleItems(false);
    }
}
