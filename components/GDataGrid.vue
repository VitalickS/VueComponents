<template>
  <div class="g-datatable">
    <div class="g-toolbar">
      <v-row no-gutters align="center">
        <v-col cols="auto">
          <slot name="label">
            <v-row no-gutters class="caption" align="center">
              <slot name="prepend-label">
                <span class="mx-2">{{ toolbarName }}</span>
              </slot>
              <v-chip
                x-small
                v-show="items.length !== filteredItems.length"
                :disabled="!multipleSelection"
                title="Select filtered (visible) items"
                @click="selectFiltered"
              >
                {{ filteredItems.length }}
              </v-chip>
              <span class="mx-1" v-show="items.length !== filteredItems.length">
                of
              </span>
              <v-chip
                x-small
                :disabled="!multipleSelection"
                title="Select all items"
                @click="selectAll"
              >
                {{ items.length }}
              </v-chip>
              <span class="mx-1" v-show="selectedItems.size">
                Selected
              </span>
              <v-chip
                x-small
                title="Selected items"
                v-show="selectedItems.size"
              >
                {{ selectedItems.size }}
              </v-chip>
              <v-chip
                x-small
                class="mx-1"
                color="primary"
                v-show="selectedItems.size"
                @click="clearSelection"
              >
                CLEAR SELECTION
              </v-chip>
            </v-row>
          </slot>
        </v-col>
        <v-spacer></v-spacer>
        <v-col cols="auto">
          <v-menu left :close-on-content-click="false" v-model="tableMenu">
            <v-card width="400">
              <v-card-title>TABLE CONFIGURATOR</v-card-title>
              <v-card-text>
                <v-tabs v-model="tab">
                  <v-tab key="1">
                    <v-icon left>mdi-table-column-width</v-icon>
                    Columns
                  </v-tab>
                  <v-tab key="2">
                    <v-icon left>mdi-file-export-outline</v-icon>
                    Export
                  </v-tab>
                  <v-tabs-items v-model="tab">
                    <v-tab-item key="1">
                      <v-text-field
                        hide-details
                        solo-inverted
                        dense
                        class="mt-1"
                        v-model="layoutName"
                      ></v-text-field>
                      <v-card dense class="ma-1 mb-4">
                        <v-row no-gutters>
                          <v-virtual-scroll
                            :bench="1"
                            ref="headerList"
                            :items="headers"
                            height="400"
                            item-height="28"
                            style="overflow-x: hidden"
                          >
                            <template v-slot:default="{ item }">
                              <v-row
                                no-gutters
                                class="px-2"
                                @pointerdown="
                                  filterMenuModel = item;
                                  scrollIntoColumn(item.value);
                                "
                                align="center"
                                :class="{
                                  'primary white--text':
                                    filterMenuModel === item
                                }"
                              >
                                <v-col cols="auto">
                                  <v-icon
                                    small
                                    left
                                    class="g-drag-poiner"
                                    @pointerdown="beginColDrag(item, $event)"
                                    @pointerup="endColDrag($event)"
                                    @pointermove="colDrag($event)"
                                  >
                                    mdi-menu
                                  </v-icon>
                                </v-col>
                                <v-col cols="auto" :title="item.value">
                                  <input
                                    v-model="item.text"
                                    style="color: inherit; border: none; outline: none;"
                                  />
                                </v-col>
                                <v-spacer></v-spacer>
                                <!-- <v-col cols="auto">
                                  <v-btn
                                    small
                                    icon
                                    @click.stop="reorder(item.value, -1)"
                                  >
                                    <v-icon small>
                                      mdi-arrow-up
                                    </v-icon>
                                  </v-btn>
                                </v-col>
                                <v-col cols="auto">
                                  <v-btn
                                    small
                                    icon
                                    @click.stop="reorder(item.value, +1)"
                                  >
                                    <v-icon small>
                                      mdi-arrow-down
                                    </v-icon>
                                  </v-btn>
                                </v-col> -->
                                <v-col cols="auto">
                                  <v-btn
                                    @click="showMenu(item, $event)"
                                    small
                                    icon
                                    v-if="filters[item.value]"
                                    :title="
                                      `${filterConditions[item.value] ||
                                        'Contains'} ${filters[item.value]}`
                                    "
                                  >
                                    <v-icon small>mdi-filter</v-icon>
                                  </v-btn>
                                  <v-btn
                                    width="80"
                                    small
                                    tile
                                    elevation="0"
                                    :color="item.hidden ? 'primary' : 'warning'"
                                    @click="toggleColumnVisible(item)"
                                  >
                                    <v-icon small left>
                                      {{
                                        item.hidden ? "mdi-eye" : "mdi-eye-off"
                                      }}
                                    </v-icon>
                                    <v-spacer></v-spacer>
                                    {{ item.hidden ? "Show" : "Hide" }}
                                  </v-btn>
                                </v-col>
                              </v-row>
                            </template>
                          </v-virtual-scroll>
                        </v-row>
                      </v-card>
                      <!-- <v-col cols="2" style="padding-left: 10px;">
                          <v-btn small fab class="mb-1">
                            <v-icon small>mdi-arrow-collapse-left</v-icon>
                          </v-btn>
                          <v-btn small fab class="mb-1">
                            <v-icon small>mdi-arrow-left</v-icon>
                          </v-btn>
                          <v-btn small fab class="mb-1">
                            <v-icon small>mdi-arrow-right</v-icon>
                          </v-btn>
                          <v-btn small fab class="mb-1">
                            <v-icon small>mdi-arrow-collapse-right</v-icon>
                          </v-btn>
                        </v-col>
                        <v-col cols="5">
                          <v-card tile>
                            <v-list height="300" dense style="overflow-y: auto">
                              <v-list-item
                                v-for="(col, colIdx) in headers"
                                :key="colIdx"
                              >
                                {{ col.text }}</v-list-item
                              >
                            </v-list>
                          </v-card>
                        </v-col> -->

                      <v-row no-gutters class="ma-1">
                        <v-btn
                          small
                          tile
                          color="primary"
                          @click="
                            saveLayout();
                            tableMenu = false;
                          "
                        >
                          Save
                        </v-btn>
                        <v-spacer></v-spacer>
                        <v-btn tile small @click="hideAllColumns">
                          Hide All
                        </v-btn>
                        <v-btn tile small @click="showAllColumns">
                          Show All
                        </v-btn>
                      </v-row>
                    </v-tab-item>
                    <v-tab-item key="2">
                      <v-card class="ma-1">
                        <v-card-text>
                          <v-switch
                            label="Save format (XLS)"
                            inset
                            v-model="exportFormatted"
                          ></v-switch>
                        </v-card-text>
                        <v-card-actions>
                          <v-spacer></v-spacer>
                          <v-btn
                            tile
                            :disabled="!selectedItems.size"
                            @click="exportSelected"
                          >
                            Export Selected
                          </v-btn>
                          <v-btn tile color="primary" @click="exportAll">
                            Export All
                          </v-btn>
                        </v-card-actions>
                      </v-card>
                    </v-tab-item>
                  </v-tabs-items>
                </v-tabs>
              </v-card-text>
              <!--
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn>save</v-btn>
              </v-card-actions>
              
              -->
            </v-card>
            <template v-slot:activator="{ on }">
              <v-btn small icon v-on="on" class="mr-1" color="success darken-2">
                <v-icon small>mdi-table-cog</v-icon>
              </v-btn>
            </template>
          </v-menu>
        </v-col>
        <v-col cols="auto" style="position:relative" class="mr-n1">
          <select v-model="activeLayout" class="g-datatable-header-layout">
            <option :value="l" :key="l" v-for="l in getLayoutNames()">
              {{ l }}
            </option>
          </select>
          <v-icon small style="position: absolute;right: 3px; top: 3px;">
            mdi-chevron-down
          </v-icon>
        </v-col>
        <v-col cols="auto" class="mr-n1">
          <v-btn
            small
            icon
            :title="`Delete '${activeLayout}' layout`"
            @click="deleteLayout(activeLayout)"
          >
            <v-icon small color="error">mdi-minus</v-icon>
          </v-btn>
        </v-col>
        <v-col cols="auto" class="mr-n1">
          <v-btn small icon title="Create new layout" @click="createNewLayout">
            <v-icon small color="primary">mdi-plus</v-icon>
          </v-btn>
        </v-col>
        <v-col cols="auto">
          <v-btn
            small
            icon
            @click="saveLayout()"
            :title="`Save '${activeLayout}' layout`"
          >
            <v-icon small color="primary">mdi-floppy</v-icon>
          </v-btn>
        </v-col>
        <v-col cols="auto" style="position: relative">
          <input
            class="g-quick-search"
            placeholder="Quick Search"
            v-model="quickSearch"
            @keydown.enter="syncFilteredItems"
          />
          <v-icon
            small
            style="position:absolute; right: 0; top: 4px;"
            @click="
              quickSearch = '';
              syncFilteredItems();
            "
          >
            {{ quickSearch ? "mdi-close" : "mdi-magnify" }}
          </v-icon>
        </v-col>
      </v-row>
    </div>
    <div class="g-datatable-container" @scroll="scrolling">
      <div class="g-datatable-sticky">
        <div class="g-datatable-headers">
          <v-menu
            :position-x="menuX"
            :position-y="menuY"
            absolute
            offset-y
            :close-on-content-click="false"
            v-model="filterMenu"
            style="z-index: 100;"
          >
            <v-card dense width="275px">
              <v-card-title>
                <v-text-field
                  dense
                  outlined
                  v-model="tempTexts[filterMenuModel.value]"
                  :label="`Header for ${filterMenuModel.value}`"
                  hide-details
                  @keydown.enter="applyFilter(filterMenuModel)"
                ></v-text-field>
              </v-card-title>
              <v-card-text>
                <v-row class="mx-0 my-1" justify="center" align="center">
                  <v-btn
                    tile
                    x-small
                    @click="reorder(filterMenuModel.value, -headers.length)"
                  >
                    <v-icon small>mdi-arrow-expand-left</v-icon>
                  </v-btn>
                  <v-btn
                    tile
                    x-small
                    @click="reorder(filterMenuModel.value, -1)"
                  >
                    <v-icon small>mdi-arrow-left</v-icon>
                  </v-btn>
                  <v-btn
                    tile
                    x-small
                    @click="reorder(filterMenuModel.value, +1)"
                  >
                    <v-icon small>mdi-arrow-right</v-icon>
                  </v-btn>
                  <v-btn
                    tile
                    x-small
                    @click="reorder(filterMenuModel.value, headers.length)"
                  >
                    <v-icon small>mdi-arrow-expand-right</v-icon>
                  </v-btn>
                  <v-spacer></v-spacer>

                  <v-btn
                    fab
                    color="warning"
                    x-small
                    @click="toggleColumnVisible(filterMenuModel)"
                  >
                    <v-icon small>
                      {{ filterMenuModel.hidden ? "mdi-eye" : "mdi-eye-off" }}
                    </v-icon>
                  </v-btn>
                </v-row>
                <v-row class="mx-0">
                  <v-select
                    v-model="filterConditions[filterMenuModel.value]"
                    @change="updateTempFilters(tempFilters[filterMenuModel.value], filterMenuModel.value)"
                    dense
                    solo
                    hide-details
                    :items="conditions"
                    placeholder="*"
                  ></v-select>
                </v-row>
                <v-row class="mx-0">
                  <v-text-field
                    outlined
                    dense
                    hide-details
                    prepend-inner-icon="mdi-magnify"
                    placeholder="find"
                    :name="filterMenuModel.value"
                    :value="tempFilters[filterMenuModel.value]"
                    @input="updateTempFilters($event, filterMenuModel.value)"
                    @keydown.enter="applyFilter(filterMenuModel)"
                  ></v-text-field>
                </v-row>
                <v-card dense class="mt-3">
                  <v-virtual-scroll
                    :bench="2"
                    :items="colValues[filterMenuModel.value]"
                    height="200"
                    item-height="32"
                  >
                    <template v-slot:default="{ item }">
                      <v-list-item
                        max-height="32"
                        dense
                        @click="selectFilter(filterMenuModel.value, item)"
                      >
                        <v-list-item-content>
                          <v-list-item-title>
                            {{ item }}
                          </v-list-item-title>
                        </v-list-item-content>
                      </v-list-item>
                    </template>
                  </v-virtual-scroll>
                </v-card>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn
                  small
                  color="success"
                  @click="applyFilter(filterMenuModel)"
                >
                  <v-icon left small>mdi-filter</v-icon>
                  filter
                </v-btn>
                <v-btn
                  small
                  color="error"
                  @click="resetFilter(filterMenuModel.value)"
                >
                  <v-icon left small>mdi-filter-remove</v-icon>
                  reset
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
          <div
            v-for="(h, hIdx) in headers.filter(h => !h.hidden)"
            :key="hIdx"
            :ref="`header-${h.value}`"
            class="g-datatable-header-col"
            :class="{ active: h === filterMenuModel }"
            :style="{ width: nWidth(h.width), minWidth: nWidth(h.width) }"
          >
            <div class="g-datatable-header-col-label">
              <v-row
                no-gutters
                @click="toggleHeader(h.value, $event)"
                style="max-height: 1.2rem; overflow: hidden;"
              >
                <v-col cols="auto">
                  <span>{{ h.text }}</span>
                </v-col>
                <v-col cols="auto">
                  <v-icon small v-if="sortColumns.includes(h.value)">
                    mdi-sort-ascending
                  </v-icon>
                  <v-icon
                    small
                    v-else-if="sortColumns.includes(h.value + ' desc')"
                  >
                    mdi-sort-descending
                  </v-icon>
                </v-col>
                <v-spacer></v-spacer>
                <v-col cols="auto" style="position: relative">
                  <v-icon
                    style="position:absolute; right: 0; top: 2px;"
                    small
                    class="g-filter-icon"
                    @click.stop="showMenu(h, $event)"
                    :style="{ opacity: hasFilter(h.value) ? 1 : 0.4 }"
                  >
                    mdi-filter
                  </v-icon>
                </v-col>
              </v-row>
              <div class="g-datatable-filterrow g-datatable-filtercell">
                <input
                  @keydown.enter="syncFilteredItems"
                  placeholder="*"
                  v-model="filters[h.value]"
                  class="g-datatable-header-quickfilter"
                  :class="{ 'has-value': filters[h.value] }"
                />

                <button
                  v-show="filters[h.value]"
                  tabindex="-1"
                  @click="
                    filters[h.value] = '';
                    syncFilteredItems();
                  "
                  class="g-datatable-clear-filter"
                  title="Clear this filter"
                >
                  <v-icon x-small>mdi-close</v-icon>
                </button>
              </div>
            </div>
            <div
              class="g-datatable-resizer"
              @pointerdown="beginResizeCol(h, $event)"
              @pointerup="endResizeCol($event)"
              @pointermove="resizeCol($event)"
            ></div>
          </div>
        </div>
      </div>
      <div class="g-loader" v-show="loadingInternal">
        <v-progress-circular
          class="mr-2"
          size="25"
          color="primary"
          indeterminate
        ></v-progress-circular>
        <span class="body-1">Loading... Please wait</span>
      </div>
      <div
        class="g-datatable-body"
        :style="{ minHeight: containerHeight + 'px' }"
        v-if="items.length"
      >
        <div
          @pointerdown.stop="toggleSelection(row, $event)"
          class="g-datatable-row"
          v-for="(row, rowIdx) in visibleItems"
          :key="row[trackId]"
          :data-rowidx="rowIdx"
          :class="{
            odd: (beginIdx + rowIdx) % 2 === 1,
            selected: selectedItems.has(row),
            active: row === lastSelectedItem
          }"
          :style="{
            height: rowHeight + 'px',
            top: beginIdx * rowHeight + rowHeight * rowIdx + 'px',
            left: colOffset + 'px'
          }"
        >
          <div
            class="gd-cell"
            v-for="(h, hIdx) in visibleHeaders"
            :key="h.value"
            :style="{ width: nWidth(h.width) }"
          >
            <slot
              :name="`cell.${h.value}`"
              :item="row"
              :index="beginIdx + rowIdx + itemsBefore"
              :value="row[h.value]"
            >
              <div v-if="quickSearch">
                <span v-text="qsLeft(getCellValue(row, h))"></span>
                <span
                  v-text="qsHighlight(getCellValue(row, h))"
                  class="g-quickhighlight"
                ></span>
                <span v-text="qsRight(getCellValue(row, h))"></span>
              </div>
              <div v-else v-text="getCellValue(row, h)"></div>
            </slot>
          </div>
        </div>
      </div>
    </div>
    <div class="g-datatable-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script src="./GDataGrid.ts"></script>

<style lang="scss">
.v-application.theme--dark {
  .g-datatable {
    --background: #222;
    --header-bgnd-color: linear-gradient(
      180deg,
      rgba(100, 100, 100, 1) 0%,
      rgba(66, 66, 66, 1) 5%,
      rgba(66, 66, 66, 1) 93%,
      rgba(33, 33, 33, 1) 100%
    );
    --header-filter-bgnd-color: linear-gradient(
      180deg,
      rgba(100, 100, 100, 1) 0%,
      rgba(66, 66, 66, 1) 100%
    );

    --outline-color: #444;
    --header-filter-bgnd-noval-color: #222;
    --header-border-color: #888;
    --even-color: #0002;
  }
  input,
  select {
    color: white;
  }
  .g-quickhighlight {
    background-color: #33f;
    color: white;
  }
}

.g-datatable {
  --outline-color: #e8e8e8;
  --odd-color: #80808018;
  --even-color: white;
  --header-border-color: #888;
  --row-hover-color: #f8e8f050;
  --row-focus-color: #8af;
  --row-focus-text-color: black;
  --active-color: #67d;
  --active-text-color: white;
  --background: #f8f8f8;
  --header-bgnd-color: linear-gradient(
    180deg,
    rgba(255, 255, 255, 1) 0%,
    rgba(235, 235, 235, 1) 26%,
    rgba(255, 255, 255, 1) 100%
  );

  --header-filter-bgnd-noval-color: linear-gradient(
    180deg,
    rgba(255, 255, 255, 1) 0%,
    rgb(246, 254, 255) 25%,
    rgba(246, 254, 255, 1) 75%,
    rgba(255, 255, 255, 1) 100%
  );
  --header-filter-bgnd-color: linear-gradient(
    180deg,
    rgba(255, 255, 255, 1) 0%,
    rgba(252, 255, 220, 1) 25%,
    rgba(252, 255, 220, 1) 75%,
    rgba(255, 255, 255, 1) 100%
  );
}

.g-datatable-container {
  background: var(--background);
  display: flex;
  flex-flow: column;

  font-size: small;
  min-height: 200px;
  max-height: 80vh;
  overflow-y: scroll;
  border: 1px solid var(--outline-color);
}
.g-datatable-sticky {
  position: sticky;
  top: 0;
  z-index: 5;
}
.g-datatable-headers {
  display: flex;
  font-weight: bolder;
  min-height: 2.2em;
}
.g-datatable-header-col {
  cursor: pointer;
  border-right: 1px solid var(--outline-color);
  background: var(--header-bgnd-color);
  display: flex;
  align-items: center;
  overflow-x: hidden;
  position: relative;
  border: 1px solid var(--header-border-color);
  border-right: none;
  &.active {
    background: var(--active-color);
    color: var(--active-text-color);
    .g-filter-icon {
      color: var(--active-text-color);
    }
  }
}
.g-datatable-header-col-label {
  padding: 0 3px 3px 2px;
  flex: 1;
}
.g-datatable-filterrow {
  &.g-datatable-filtercell {
    position: relative;
    overflow: hidden;
    margin-top: 2px;
  }
  display: flex;

  input,
  select {
    width: 100%;
    outline: none;
    padding: 0 2px;
    background: var(--header-filter-bgnd-noval-color);
    font-size: smaller;
    border: none;
    &.has-value {
      background: transparent;
    }
  }

  .g-datatable-clear-filter {
    position: absolute;
    right: 2px;
    top: -2px;
    z-index: 1;
    border: none;
    outline: none;
  }
}
.g-datatable-body {
  font-size: smaller;
  position: relative;
}
.g-datatable-row {
  display: flex;
  position: absolute;
  border-top: 1px solid var(--outline-color);
  background: var(--even-color);
  &.active {
    background: var(--active-color) !important;
    color: var(--active-text-color) !important;
  }
}
.g-datatable-row:hover,
.g-datatable-row.odd:hover {
  background: var(--row-hover-color);
}
.g-datatable-row.selected,
.g-datatable-row.odd.selected {
  background: var(--row-focus-color);
  color: var(--row-focus-text-color);
  outline: 1px solid var(--outline-color);
  z-index: 1;
}
.g-datatable-row.odd {
  background: var(--odd-color);
}
.gd-cell {
  border-right: 1px solid var(--outline-color);
  padding: 3px;
  & > div {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }
}
.g-datatable-resizer {
  z-index: 100;
  width: 5px;
  right: -1px;
  cursor: ew-resize;
  position: absolute;
  height: 100%;
  background: var(--outline-color);
  opacity: 0;
}
.g-datatable-resizer:hover {
  opacity: 1;
}
input.g-datatable-header-quickfilter {
  padding: 2px 2px 0 2px;
  width: 100%;
  outline: none;
}
select.g-datatable-header-layout {
  border: 1px solid var(--header-border-color);
  background: var(--header-filter-bgnd-noval-color);
  margin-right: 4px;
  padding: 0 3px;
  height: 1.2rem;
  font-size: small;
  outline: none;
  width: 100px;
}

.g-toolbar {
  padding: 0 3px 0 0;
  border: 1px solid var(--outline-color);
  border-radius: 4px 4px 0 0;
  background: var(--outline-color);
  .g-quick-search {
    width: 100px;
    border: 1px solid var(--header-border-color);
    border-radius: none;
    padding: 0 16px 0 2px;
    height: 1.2rem;
    font-size: small;
    outline: none;
    background: var(--header-filter-bgnd-noval-color);
  }
  .g-quick-search:focus {
    outline: 1px solid var(--header-border-color);
  }
}

.g-datatable-footer {
  background: var(--outline-color);
}
.g-quickhighlight {
  background-color: yellow;
  color: black;
}
.g-loader {
  position: absolute;
  width: 250px;
  left: calc(50% - 125px);
  margin-top: 90px;
  text-align: center;
  padding: 1em;
  border: 1px solid var(--header-border-color);
  background-color: var(--outline-color);
  z-index: 1;
}
.g-drag-poiner {
  cursor: move;
}
</style>
