import clientFactory from '@/backend/client-factory';
import { DataWrapper, TPSUserJsonGridLayout } from '@/backend/generated';
import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';

const layoutApi = clientFactory.createGridLayoutApi();

export interface ILayout {
    headers: IHeaderModel[];
    filters: Record<string, string>;
    sortColumns: string[];
    quickSearch: string;
    filterConditions: FilterConditions;
}

export interface IHeaderModel {
    value: string;
    text?: string;
    format?: string;
    hidden?: boolean;
    width: number;
}

export type FilterConditions = (
    'Contains' | 'Equals' |
    'Starts With' | 'Ends With' |
    'Not Equal' | 'Greater Than' |
    'Less Than' | 'In');

@Component({})
export default class GDataGridClass extends Vue {

    /** Properties */

    @Prop({ default: () => [] })
    public items!: any[];

    @Prop({ default: 'Items', type: String })
    public toolbarName!: string;

    @Prop({ default: 200, type: Number })
    public height!: number;

    @Prop({ required: true })
    public tableId!: string;

    @Prop({ required: true })
    public trackId!: string;

    @Prop({ default: () => ([]) })
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

    @Prop()
    public selectedItem!: any;

    @Prop({ default: () => (new Set<any>()) })
    public selectedItems!: Set<any>;

    @Prop({ default: '<UNDEFINED>' })
    public undefinedText!: string;

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

    //#region R
    private layouts: TPSUserJsonGridLayout[] = [];
    private currentLayoutName = '';
    private renamingStage = false;
    //#endregion

    /** Getters (computed) */

    public get storageId() {
        return 'gtable-layout-' + this.tableId;
    }

    public get layout() {
        return this.layouts.find((l) => l.tpsLayoutName === this.currentLayoutName);
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
            headers: this.headers,
            filters: this.filters,
            sortColumns: this.sortColumns,
            quickSearch: this.quickSearch,
            filterConditions: this.filterConditions,
        }));
    }

    public set layoutObject(value: ILayout) {
        const cloned = JSON.parse(JSON.stringify(value));
        this.filters = cloned.filters;
        this.sortColumns = cloned.sortColumns;
        this.quickSearch = cloned.quickSearch ?? '';
        this.filterConditions = cloned.filterConditions ?? {};
        this.$emit('update:headers', cloned.headers);
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
            return v.toString().replace('T00:00:00', '');
        } else if (typeof v === 'string' && v.endsWith('T00:00:00')) {
            return v.substr(0, v.length - 9);
        }
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
        if (!Vue.config.productionTip) {
            // tslint:disable-next-line:no-console
            // console.log('updateVisibleItems', new Date().valueOf() - initTime);
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

    @Watch('tableId')
    public async tableIdChanged() {
        if (!this.tableId) {
            return;
        }
        console.log('TableID changed', this.tableId);
        this.switchingMode = true;
        this.clearSelection();
        await this.initialize();
        this.switchingMode = false;
    }

    @Watch('items', { deep: true })
    public syncFilteredItems() {
        clearTimeout(this.syncTimeoutId);
        const allKeys = this.headers.map((h) => h.value);
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
        return this.headers.find((h) => h.value === fieldName);
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
        await layoutApi.updateLayout(
            this.layout?.layoutID,
            new DataWrapper({ data: JSON.stringify(this.layoutObject) }),
        );
    }

    /** Ask user for new layout name and create new layout from current layout view */
    public async createNewLayout(newLayoutName?: string) {
        if (!newLayoutName) {
            newLayoutName = prompt('Enter new layout name') ?? undefined;
        }
        if (newLayoutName) {
            this.layouts.push(await layoutApi.addLayout(new TPSUserJsonGridLayout({
                isPublic: false,
                tpsLayoutName: newLayoutName,
                tpsGridViewName: this.tableId,
                tpsGridLayout: JSON.stringify(this.layoutObject),
            })));
            this.currentLayoutName = newLayoutName;
        }
    }

    /** Delete named layout from storage */
    public async deleteLayout() {
        if (prompt('Delete current layout? Type `yes` to confirm.') === 'yes') {
            const layoutIndex = this.layouts.findIndex((l) => l.tpsLayoutName === this.currentLayoutName);
            layoutApi.deleteLayout(this.layout?.layoutID);
            this.currentLayoutName = this.layouts[0].tpsLayoutName ?? 'Default';
            this.layouts.splice(layoutIndex, 1);
            this.$forceUpdate();
        }
    }

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
        this.updateVisibleHeaders();
    }

    @Watch('filterMenu')
    private filterMenuChanged(fieldName: string) {
        if (!this.filterMenu) {
            this.colValues[fieldName] = this.getColValues(fieldName);
            this.closeFilter();
        } else {
            this.tempTexts[fieldName] = this.headers.find((h) => h.value === fieldName)?.text ?? this.tempTexts[fieldName];
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
        const layout = this.layouts.find((l) => l.tpsLayoutName === this.currentLayoutName);
        if (layout) {
            let parsedLayout = JSON.parse(layout?.tpsGridLayout ?? '{}') as (ILayout | any[]);
            if (Array.isArray(parsedLayout)) {
                parsedLayout = Object.assign(this.layoutObject,
                    { headers: parsedLayout, filters: {}, sortColumns: [], quickSearch: '', filterConditions: {} });
            }
            // parsedLayout.headers.forEach((h) => h.)
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
            if (this.layouts.some((x) => x.tpsLayoutName === newName)) {
                return;
            }
            await layoutApi.renameLayout(this.layout.layoutID, newName);
            this.renamingStage = true;
            this.layout.tpsLayoutName = newName;
            this.currentLayoutName = newName;
        }
    }

    private async loadLayouts() {
        this.layouts = await layoutApi.getLayouts(this.tableId);
        if (!this.layouts || !this.layouts.length) {
            await this.createNewLayout('Default');
        }
    }

    private async mounted() {
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

        await this.initialize();
    }

    private async initialize() {
        await this.loadLayouts();
        this.currentLayoutName = localStorage.getItem(this.storageId) ?? this.layouts[0].tpsLayoutName ?? 'Default';
        this.currentLayoutNameChanged();
        this.syncFilteredItems();
        await this.updateVisibleItems(false);
        await this.updateVisibleHeaders();
        this.loadingInternal = this.loading;
    }

    private beforeDestroy() {
        this.$root.$off('gdatagrid.add');
        this.$root.$off('gdatagrid.delete');
        this.$root.$off('gdatagrid.highlight');
        this.$root.$off('gdatagrid.invalidate');
    }
}
