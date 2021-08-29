export interface LayoutApi {
    updateLayout(layoutModel: JsonGridLayout, layout: ILayout): PromiseLike<void>;
    deleteLayout(layout: JsonGridLayout): PromiseLike<void>;
    addLayout(newLayout: JsonGridLayout): Promise<JsonGridLayout>;
    getLayouts(tableId: string): PromiseLike<JsonGridLayout[]>;
    renameLayout(layout: JsonGridLayout, newName: string): PromiseLike<void>;
}

export interface JsonGridLayout {
    layoutID: number;
    tableID: string;
    layoutName: string;
    gridLayoutJson: string;
    isPublic: boolean;

}

export interface ILayout {
    headers: IHeaderModel[];
    filters: Record<string, string>;
    sortColumns: string[];
    quickSearch: string;
    filterConditions: Record<string, FilterConditions>;
}
export interface IHeaderModel {
    value: string;
    text?: string;
    format?: string;
    hidden?: boolean;
    width: number;
}

export interface IExportDataParameters {
    name?: string | undefined;
    headers?: IHeaderType[] | undefined;
    rows?: any[] | undefined;
}
export interface IHeaderType {
    text?: string | undefined;
    width?: number;
    value?: string | undefined;
    format?: string | undefined;
}

export type FilterConditions = (
    'Contains' | 'Equals' |
    'Starts With' | 'Ends With' |
    'Not Equal' | 'Greater Than' |
    'Less Than' | 'In');
