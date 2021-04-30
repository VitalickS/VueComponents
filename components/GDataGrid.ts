import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';

export interface IHeaderModel {
    value: string;
    text?: string;
    format?: string;
    hidden?: boolean;
    width: number;
}

export type FilterConditions = ('Contains' | 'Equals' | 'Starts With' | 'Ends With' | 'Not Equal' | 'Greater Than' | 'Less Than');

@Component({})
export default class GDataGridClass extends Vue {

    /** Properties */

    @Prop({ default: () => [] })
    public items!: any[];

    @Prop({ default: 'Items', type: String })
    public toolbarName!: string;

    @Prop({ required: true })
    public tableId!: string;

    @Prop({ required: true })
    public trackId!: string;

    @Prop()
    public headers!: IHeaderModel[];

    @Prop({ default: 22 })
    public rowHeight!: number;

    @Prop({ default: 30 })
    public itemsBefore!: number;

    @Prop({ default: 40 })
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

    @Prop({ default: false })
    public loading!: boolean;

    /** Fields */

    public loadingInternal = false;
    public filteredItems: any[] = [];
    public quickSearch = '';

    public sortColumns: string[] = [];

    public visibleItems: any[] = [];
    public visibleHeaders: IHeaderModel[] = [];
    public top = 0;
    public left = 0;
    public beginIdx = 0;
    public selectedItems: Set<any> = new Set<any>();
    public exportFormatted = true;

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
    private gridLayouts: Record<string, any> = {};
    private colValues: Record<string, any[]> = {};
    private visualStates: Record<any, { hightlight: string, color: string, status?: string }> = {};
    private draggingheader?: IHeaderModel;

    /** Getters (computed) */

    public get storageId() {
        return 'gtable-layout-' + this.tableId;
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
        ] as FilterConditions[];
    }

    /** Public functions */

    public exportSelected() {
        this.fnExcelReport(this.filteredItems);
        this.$emit('export-selected', { format: this.exportFormatted });
    }

    public exportAll() {
        this.fnExcelReport(this.items);
        this.$emit('export-all', { format: this.exportFormatted });
    }

    public nWidth(w: number) {
        if (!w || w < 5) {
            return '5px';
        }
        if (typeof w === 'number') {
            return w + 'px';
        }
    }

    public defaultGlobalFormat(v: any) {
        return v;
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

    public getCellValue(row: any, header: any) {
        return this.globalFormat(header.format ? header.format(row[header.value], row) : row[header.value]);
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

    public reorder(fieldName: string, delta: number) {
        let colIndex = this.headers.findIndex((h) => h.value === fieldName);
        if (colIndex < 0) { return; }
        const header = this.headers[colIndex];
        this.headers.splice(colIndex, 1);
        colIndex += delta;
        if (colIndex < 0) {
            colIndex = 0;
        }
        if (colIndex >= this.headers.length) {
            colIndex = this.headers.length;
        }
        this.headers.splice(colIndex, 0, header);
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
        this.filters[fieldName] = '';
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
        if (e.button === 1) {
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
        this.lastSelectedItemTime = new Date();
        this.$forceUpdate();
    }

    public hideAllColumns() {
        this.headers.forEach((h) => h.hidden = true);
        this.updateVisibleHeaders();
    }

    public showAllColumns() {
        this.headers.forEach((h) => h.hidden = false);
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
        const headers = this.headers.filter((h) => !h.hidden);
        headers.forEach((h) => this.containerWidth += h.width);

        // Headers

        this.visibleHeaders = [];
        this.colOffset = 0;
        let colStartIndex = 0;
        let colLength = 1;
        let colSumWidth = this.$el.clientWidth + this.colSpaceAfter + this.colSpaceBefore;
        let visiblePartStarted = false;
        headers.some((header) => {
            if (visiblePartStarted) {
                colLength++;
                colSumWidth -= header.width;
                if (colSumWidth < 0) {
                    return true;
                }
            } else {
                if (this.colOffset + this.colSpaceBefore + header.width > this.left) {
                    visiblePartStarted = true;
                    return;
                }
                colStartIndex++;
                this.colOffset += header.width;
            }
        });

        const newVisibleHeaders = headers.slice(colStartIndex, colStartIndex + colLength);
        if (JSON.stringify(newVisibleHeaders) !== JSON.stringify(this.visibleHeaders)) {
            this.visibleHeaders = newVisibleHeaders;
        }

        await this.$nextTick();
        if (!Vue.config.productionTip) {
            // tslint:disable-next-line:no-console
            console.log('updateVisibleHeaders', new Date().valueOf() - initTime);
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
        this.containerHeight = this.rowHeight * this.filteredItems.length;

        // Init visible collections
        this.visibleItems = [];
        this.beginIdx = Math.max(
            0,
            Math.round(this.top / this.rowHeight) - this.itemsBefore,
        );

        // Items

        const endIdx = Math.min(
            this.beginIdx +
            Math.round(this.$el.clientHeight / this.rowHeight) +
            this.itemsAfter +
            this.itemsBefore,
            this.filteredItems.length - 1,
        );

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
        if (!Vue.config.productionTip) {
            // tslint:disable-next-line:no-console
            console.log('updateVisibleItems', new Date().valueOf() - initTime);
        }
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

    @Watch('items', { deep: true })
    public syncFilteredItems() {
        clearTimeout(this.syncTimeoutId);
        const allKeys = this.headers.map((h) => h.value);
        const filterKeys = Object.keys(this.filters).filter((k) => this.filters[k]);
        const quickSearch = this.quickSearch;
        if (filterKeys.length || quickSearch) {
            this.filteredItems = this.sortItems(this.items.filter((item) => {
                const fResult = this.filterItem(item, filterKeys);
                if (!fResult) {
                    return false;
                }
                if (quickSearch) {
                    for (const key of allKeys) {
                        if (item[key]?.toString().includes(quickSearch)) {
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
        this.updateVisibleItems(false);
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
    }

    //#region LAYOUTS

    /** Get current layout (cloned) or named layout. If layout with such name not exists, then return current */
    public getLayout(name?: string): any {
        if (name) {
            return JSON.parse(JSON.stringify(this.gridLayouts[name] ?? this.getLayout()));
        }
        return JSON.parse(JSON.stringify({
            headers: this.headers,
            filters: this.filters,
            sortColumns: this.sortColumns,
            quickSearch: this.quickSearch,
            filterConditions: this.filterConditions,
        }));
    }

    /** Switch between layouts and remember __active */
    public set activeLayout(name: string) {
        this.gridLayouts.__active = name;
        this.applyLayoutObject(this.getLayout(name));
        this.saveGridLayoutsObject();
        this.syncFilteredItems();
        this.updateVisibleHeaders();
    }

    /** Retrieve active layout name from storage */
    public get activeLayout() {
        return this.gridLayouts.__active ?? 'Default';
    }

    public set layoutName(newName: string) {
        if (newName) {
            const lobj = this.gridLayouts[this.gridLayouts.__active];
            delete this.gridLayouts[this.gridLayouts.__active];
            this.gridLayouts[newName] = lobj;
            this.gridLayouts.__active = newName;
            this.saveGridLayoutsObject();
        }
    }

    public get layoutName() {
        return this.activeLayout;
    }

    /** Clone input layout object and apply to current properties (fields) */
    public applyLayoutObject(layout: any) {
        const cloned = JSON.parse(JSON.stringify(layout));
        this.filters = cloned.filters;
        this.sortColumns = cloned.sortColumns;
        this.quickSearch = cloned.quickSearch ?? '';
        this.filterConditions = cloned.filterConditions ?? {};
        this.$emit('update:headers', cloned.headers);
    }

    /** Save current layout with specified name */
    public saveLayout(name?: string) {
        this.gridLayouts[name ?? this.activeLayout] = this.getLayout();
        this.saveGridLayoutsObject();
        if (name) {
            this.activeLayout = name;
        }
    }


    /** Retrieve layout names from storage, (for Layout Manager GUI) */
    public getLayoutNames() {
        const names = Object.keys(this.gridLayouts).filter((k) => !k.startsWith('__'));
        if (!names.length) {
            names.push('Default');
        }
        return names;
    }

    /** Ask user for new layout name and create new layout from current layout view */
    public createNewLayout() {
        const newLayoutName = prompt('Enter new layout name');
        if (newLayoutName) {
            this.saveLayout(newLayoutName);
        }
    }

    /** Delete named layout from storage */
    public deleteLayout(name: string) {
        if (prompt('Delete current layout? Type `yes` to confirm.') === 'yes') {
            delete this.gridLayouts[name];
            this.saveGridLayoutsObject();
            this.activeLayout = this.getLayoutNames()[0];
            this.$forceUpdate();
        }
    }

    //#endregion

    /** Private functions */

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
            const itemValue = item[key];
            if (filterText) {
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
                            if (!itemValue?.toString().includes(filterText)) {
                                return false;
                            }
                        }
                        break;

                }
            }
        }
        return true;
    }

    private saveGridLayoutsObject() {
        localStorage.setItem(this.storageId, JSON.stringify(this.gridLayouts));
    }

    @Watch('filters', { deep: true })
    @Watch('quickSearch')
    private filtersChanged() {
        clearTimeout(this.syncTimeoutId);
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
        this.updateVisibleHeaders();
    }

    @Watch('filterMenu')
    private filterMenuChanged(fieldName: string) {
        if (!this.filterMenu) {
            this.colValues[fieldName] = this.getColValues(fieldName);
            this.closeFilter();
        }
    }
    @Watch('tableMenu')
    private tableMenuChanged() {
        if (this.tableMenu) {
            const hiddenColl: IHeaderModel[] = [];
            for (let index = 0; index < this.headers.length; index++) {
                const header = this.headers[index];
                if (!header.hidden) {
                    hiddenColl.push(header);
                    this.headers.splice(index, 1);
                    index--;
                }
            }
            this.headers.splice(0, 0, ...hiddenColl);
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
        this.visibleHeaders.forEach((h) => html += `<th style="width: ${h.width}px">${h.text}</th>`);
        html += `</thead><tbody>`;
        items.forEach((i) => {
            html += `<tr>`;
            this.visibleHeaders.forEach((h) => html += `<td>${i[h.value]}</td>`);
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        window.open('data:application/vnd.ms-excel,' + encodeURIComponent(html));
    }

    private async mounted() {
        this.gridLayouts = JSON.parse(localStorage.getItem(this.storageId) ?? '{}');
        this.activeLayout = this.activeLayout;
        this.syncFilteredItems();
        await this.updateVisibleItems(false);
        await this.updateVisibleHeaders();
        this.loadingInternal = this.loading;
    }
}
