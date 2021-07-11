import { LayoutApi, JsonGridLayout, ILayout } from './LayoutApi';

export class LocalStorageLayoutApi implements LayoutApi {
    public async addLayout(newLayout: JsonGridLayout) {
        newLayout.layoutID = this.getNewId();
        localStorage.setItem(this.getStorageKey(newLayout), JSON.stringify(newLayout));
        return newLayout;
    }
    public async getLayouts(tableId: string) {
        return this.getTableIdLayouts(tableId)
            .map((k) => JSON.parse(localStorage.getItem(k) ?? '{}') as JsonGridLayout);
    }

    public async updateLayout(layoutModel: JsonGridLayout, layout: ILayout) {
        layoutModel.gridLayoutJson = JSON.stringify(layout);
        localStorage.setItem(this.getStorageKey(layoutModel), JSON.stringify(layoutModel));
    }

    public async deleteLayout(layout: JsonGridLayout) {
        localStorage.removeItem(this.getStorageKey(layout));
    }

    public async renameLayout(layout: JsonGridLayout, newName: string) {
        layout.layoutName = newName;
        localStorage.setItem(this.getStorageKey(layout), JSON.stringify(layout));
    }


    private getNewId() {
        const newId = parseInt(localStorage.getItem('gdatagrid.newid') ?? '1', 0);
        localStorage.setItem('gdatagrid.newid', (newId + 1).toString());
        return newId;
    }

    private getTableIdLayouts(tableId: string) {
        let k: null | string = null;
        let i = 0;
        const keys: string[] = [];
        const tableKeySubstring = `gdatagrid.${tableId}.`;
        k = localStorage.key(i);
        while (k) {
            i++;
            if (k.startsWith(tableKeySubstring)) {
                keys.push(k);
            }
            k = localStorage.key(i);
        }
        return keys;
    }

    private getStorageKey(layout: JsonGridLayout) {
        return `gdatagrid.${layout.tableID}.${layout.layoutID}`;
    }
}
