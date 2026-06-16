import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tooltip,
  Upload
} from "antd";
import type { FormInstance } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  PlusOutlined,
  ZoomInOutlined
} from "@ant-design/icons";
import { AnyRecord, imageToCompressedDataUrl, parseRows, request } from "../shared/api";

const maxSpecGroups = 3;
const maxSpecValuesPerGroup = 5;
const maxSpecValueLength = 10;
const maxSkuTextLength = 18;
const maxPrice = 99999.99;
const maxStock = 999999;
const maxMinOrderQuantity = 100;
const defaultSpecTypeNames = ["颜色", "尺码", "型号"];

type SpecValue = {
  id: string;
  value: string;
  image?: string;
};

type SpecGroup = {
  id: string;
  name: string;
  values: SpecValue[];
};

type SpecCell = {
  groupId: string;
  groupName: string;
  valueId: string;
  value: string;
  image?: string;
};

type TierPrice = {
  minQty?: number;
  price?: number;
};

type SkuRow = AnyRecord & {
  specKey?: string;
  specValues?: SpecCell[];
  skuName?: string;
  skuCode?: string;
  skuBarcode?: string;
  salePrice?: number;
  stockQuantity?: number;
  minOrderQuantity?: number;
  skuStatus?: string;
  skuImageUrl?: string;
  tierPrices?: TierPrice[];
};

type ProductSpecEditorProps = {
  form: FormInstance;
  initialSkuList: SkuRow[];
  message: AnyRecord;
  onPreviewImage: (url: string) => void;
  minOrderUnitLabel: string;
};

function HiddenFormValue(_props: { value?: unknown; onChange?: (value: unknown) => void }) {
  return null;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyValue(): SpecValue {
  return { id: makeId("value"), value: "", image: "" };
}

function normalizeTierRows(value: unknown): TierPrice[] {
  return parseRows(value)
    .map(row => ({ minQty: Number(row.minQty || 1), price: Number(row.price || 0) || undefined }))
    .filter(row => Number.isInteger(row.minQty) && Number(row.minQty) > 0 && Number(row.price) > 0);
}

function stableSpecKey(specValues: SpecCell[] = []) {
  return [...specValues]
    .sort((a, b) => `${a.groupId}:${a.valueId}`.localeCompare(`${b.groupId}:${b.valueId}`))
    .map(item => `${item.groupId}:${item.valueId}`)
    .join("|");
}

function rowLookupKeys(row: SkuRow) {
  const keys = new Set<string>();
  if (row.specKey) keys.add(String(row.specKey));
  if (Array.isArray(row.specValues) && row.specValues.length) keys.add(stableSpecKey(row.specValues));
  if (row.skuName) keys.add(String(row.skuName));
  return keys;
}

function normalizeSkuText(value: unknown) {
  return String(value || "").replace(/[^0-9a-zA-Z]/g, "").slice(0, maxSkuTextLength);
}

function createBaseSkuRow(source?: SkuRow): SkuRow {
  return {
    ...(source || {}),
    skuCode: source?.skuCode || "",
    skuBarcode: source?.skuBarcode || "",
    skuName: source?.skuName || "",
    skuImageUrl: source?.skuImageUrl || "",
    salePrice: source?.salePrice,
    stockQuantity: source?.stockQuantity,
    minOrderQuantity: Number(source?.minOrderQuantity || 1),
    skuStatus: source?.skuStatus || "ENABLED",
    specKey: "",
    specValues: [],
    tierPrices: normalizeTierRows(source?.tierPrices)
  };
}

function normalizeBaseSkuRows(rows: SkuRow[]) {
  const source = Array.isArray(rows) ? rows : [];
  const firstEnabled = source.find(row => row.skuStatus !== "DISABLED");
  return [createBaseSkuRow(firstEnabled || source[0])];
}

function createInitialSpecGroups(skuRows: SkuRow[]): SpecGroup[] {
  const rows = Array.isArray(skuRows) ? skuRows : [];
  const rowsWithSpecValues = rows.filter(row => Array.isArray(row.specValues) && row.specValues.length);
  if (!rowsWithSpecValues.length) return [];

  const groups: SpecGroup[] = [];
  const groupMap = new Map<string, SpecGroup>();

  for (const row of rowsWithSpecValues) {
    row.specValues?.forEach((cell, index) => {
      const groupId = String(cell.groupId || `group_${index}_${cell.groupName || index}`);
      const groupName = String(cell.groupName || `规格${index + 1}`).trim();
      let group = groupMap.get(groupId);
      if (!group) {
        group = { id: groupId, name: groupName, values: [] };
        groupMap.set(groupId, group);
        groups.push(group);
      }
      if (group.values.length >= maxSpecValuesPerGroup) return;

      const valueText = String(cell.value || "").trim().slice(0, maxSpecValueLength);
      if (!valueText) return;

      const valueId = String(cell.valueId || valueText);
      const exists = group.values.some(item => item.id === valueId || item.value === valueText);
      if (!exists) {
        group.values.push({ id: valueId, value: valueText, image: cell.image || "" });
      }
    });
  }

  return groups
    .slice(0, maxSpecGroups)
    .map(group => ({
      ...group,
      values: group.values.length ? group.values : [createEmptyValue()]
    }));
}

function getActiveGroups(groups: SpecGroup[]) {
  return groups
    .map((group, groupIndex) => ({
      ...group,
      name: String(group.name || "").trim(),
      values: group.values
        .map(value => ({ ...value, value: String(value.value || "").trim() }))
        .filter(value => value.value)
        .slice(0, maxSpecValuesPerGroup),
      groupIndex
    }))
    .filter(group => group.name && group.values.length);
}

function cartesian(groups: ReturnType<typeof getActiveGroups>) {
  if (!groups.length) return [] as SpecCell[][];
  return groups.reduce<SpecCell[][]>((acc, group) => {
    const cells = group.values.map(value => ({
      groupId: group.id,
      groupName: group.name,
      valueId: value.id,
      value: value.value,
      image: value.image || ""
    }));
    if (!acc.length) return cells.map(cell => [cell]);
    return acc.flatMap(combo => cells.map(cell => [...combo, cell]));
  }, []);
}

function buildSkuRows(groups: SpecGroup[], currentRows: SkuRow[], removedKeys: string[]) {
  const removedSet = new Set(removedKeys);
  const activeGroups = getActiveGroups(groups);
  if (!activeGroups.length) {
    return normalizeBaseSkuRows(currentRows)
      .filter(row => !removedSet.has(String(row.specKey || row.skuName || "")));
  }

  const combos = cartesian(activeGroups);
  const existing = new Map<string, SkuRow>();
  currentRows.forEach(row => rowLookupKeys(row).forEach(key => existing.set(key, row)));

  return combos
    .map(combo => {
      const specKey = stableSpecKey(combo);
      const skuName = combo.map(item => item.value).join(" / ");
      const oldRow = existing.get(specKey) || existing.get(skuName) || {};
      const firstSpecImage = combo.find(item => item.image)?.image || "";
      return {
        ...oldRow,
        specKey,
        specValues: combo,
        skuName,
        skuCode: oldRow.skuCode || "",
        skuBarcode: oldRow.skuBarcode || "",
        salePrice: oldRow.salePrice,
        stockQuantity: oldRow.stockQuantity,
        minOrderQuantity: Number(oldRow.minOrderQuantity || 1),
        skuStatus: oldRow.skuStatus || "ENABLED",
        skuImageUrl: oldRow.skuImageUrl || firstSpecImage,
        tierPrices: normalizeTierRows(oldRow.tierPrices)
      } as SkuRow;
    })
    .filter(row => !removedSet.has(String(row.specKey || row.skuName || "")));
}

function specPlaceholder(name: string, index: number) {
  const label = String(name || "").trim() || `规格${index + 1}`;
  return `请输入${label}`;
}

export default function ProductSpecEditor({ form, initialSkuList, message, onPreviewImage, minOrderUnitLabel }: ProductSpecEditorProps) {
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>(() => createInitialSpecGroups(initialSkuList));
  const [specTypeOptions, setSpecTypeOptions] = useState<string[]>(defaultSpecTypeNames);
  const [creatingGroupId, setCreatingGroupId] = useState("");
  const [creatingTypeName, setCreatingTypeName] = useState("");
  const [savingType, setSavingType] = useState(false);
  const [removedSkuKeys, setRemovedSkuKeys] = useState<string[]>([]);
  const [batchSalePrice, setBatchSalePrice] = useState<number | null>(null);
  const [batchStockQuantity, setBatchStockQuantity] = useState<number | null>(null);
  const [skuRows, setSkuRowsState] = useState<SkuRow[]>(() => {
    const groups = createInitialSpecGroups(initialSkuList);
    return buildSkuRows(groups, initialSkuList, []);
  });
  const [draggingValue, setDraggingValue] = useState<{ groupId: string; valueId: string } | null>(null);

  const quoteType = Form.useWatch("quoteType", form) || "INDEPENDENT_PRICE";
  const isTierPrice = quoteType === "TIER_PRICE";
  const activeGroups = useMemo(() => getActiveGroups(specGroups), [specGroups]);
  const noSpecMode = activeGroups.length === 0;
  const selectedSpecNames = useMemo(
    () => specGroups.map(group => String(group.name || "").trim()).filter(Boolean),
    [specGroups]
  );

  const getSkuRows = () => {
    const rows = form.getFieldValue("skuList");
    return Array.isArray(rows) ? rows : [];
  };

  const setSkuRows = (rows: SkuRow[]) => {
    setSkuRowsState(rows);
    form.setFieldsValue({ skuList: rows });
  };

  useEffect(() => {
    let alive = true;
    request<string[]>("/api/products/spec-types")
      .then(rows => {
        if (!alive || !Array.isArray(rows)) return;
        const merged = Array.from(
          new Set([...defaultSpecTypeNames, ...rows.map(item => String(item || "").trim()).filter(Boolean)])
        );
        setSpecTypeOptions(merged);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const nextGroups = createInitialSpecGroups(initialSkuList);
    setSpecGroups(nextGroups);
    setRemovedSkuKeys([]);
    setBatchSalePrice(null);
    setBatchStockQuantity(null);
    const nextRows = buildSkuRows(nextGroups, Array.isArray(initialSkuList) ? initialSkuList : [], []);
    setSkuRowsState(nextRows);
    form.setFieldsValue({ skuList: nextRows });
  }, [form, initialSkuList]);

  useEffect(() => {
    setSkuRowsState(currentRows => {
      const formRows = form.getFieldValue("skuList");
      const baseRows = Array.isArray(formRows) && formRows.length ? formRows : currentRows;
      const nextRows = buildSkuRows(specGroups, baseRows, removedSkuKeys);
      form.setFieldsValue({ skuList: nextRows });
      return nextRows;
    });
  }, [form, removedSkuKeys, specGroups]);

  const updateGroup = (groupId: string, updater: (group: SpecGroup) => SpecGroup) => {
    setSpecGroups(groups => groups.map(group => (group.id === groupId ? updater(group) : group)));
  };

  const moveGroup = (groupId: string, direction: -1 | 1) => {
    setSpecGroups(groups => {
      const index = groups.findIndex(group => group.id === groupId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= groups.length) return groups;
      const next = [...groups];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const addGroup = () => {
    if (specGroups.length >= maxSpecGroups) return;
    setSpecGroups(groups => [...groups, { id: makeId("group"), name: "", values: [] }]);
  };

  const startCreateType = (groupId: string) => {
    setCreatingGroupId(groupId);
    setCreatingTypeName("");
  };

  const cancelCreateType = () => {
    setCreatingGroupId("");
    setCreatingTypeName("");
  };

  const saveCreatedType = async (groupId: string) => {
    const name = String(creatingTypeName || "").trim();
    if (!name) {
      message.warning("请输入规格类型");
      return;
    }
    if (selectedSpecNames.includes(name)) {
      message.warning("该规格类型已被选择");
      return;
    }
    setSavingType(true);
    try {
      const savedName = await request<string>("/api/products/spec-types", {
        method: "POST",
        data: { name }
      });
      const nextName = String(savedName || name).trim();
      setSpecTypeOptions(current => Array.from(new Set([...current, nextName])));
      updateGroup(groupId, current => ({
        ...current,
        name: nextName,
        values: current.values.length ? current.values : [createEmptyValue()]
      }));
      cancelCreateType();
      message.success("规格类型已保存");
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setSavingType(false);
    }
  };

  const removeGroup = (groupId: string) => {
    Modal.confirm({
      title: "删除规格类型后会重新生成 SKU，是否继续？",
      okText: "继续",
      cancelText: "取消",
      onOk: () => setSpecGroups(groups => groups.filter(group => group.id !== groupId))
    });
  };

  const updateGroupName = (groupId: string, nextName: string) => {
    updateGroup(groupId, current => ({
      ...current,
      name: String(nextName || ""),
      values: nextName && !current.values.length ? [createEmptyValue()] : current.values
    }));
  };

  const addValue = (groupId: string) => {
    updateGroup(groupId, current => {
      if (current.values.length >= maxSpecValuesPerGroup) {
        message.warning("每种规格类型最多只能添加 5 个规格值");
        return current;
      }
      return { ...current, values: [...current.values, createEmptyValue()] };
    });
  };

  const updateValue = (groupId: string, valueId: string, nextValue: string) => {
    updateGroup(groupId, group => ({
      ...group,
      values: group.values.map(value =>
        value.id === valueId
          ? { ...value, value: String(nextValue || "").slice(0, maxSpecValueLength) }
          : value
      )
    }));
  };

  const removeValue = (groupId: string, valueId: string) => {
    updateGroup(groupId, group => {
      const values = group.values.filter(value => value.id !== valueId);
      return {
        ...group,
        values: values.length ? values : (group.name ? [createEmptyValue()] : [])
      };
    });
  };

  const moveValue = (groupId: string, sourceValueId: string, targetValueId: string) => {
    updateGroup(groupId, group => {
      const sourceIndex = group.values.findIndex(value => value.id === sourceValueId);
      const targetIndex = group.values.findIndex(value => value.id === targetValueId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return group;
      const nextValues = [...group.values];
      const [moved] = nextValues.splice(sourceIndex, 1);
      nextValues.splice(targetIndex, 0, moved);
      return { ...group, values: nextValues };
    });
  };

  const addRemovedSkuKeys = (keys: string[]) => {
    setRemovedSkuKeys(current => Array.from(new Set([...current, ...keys.filter(Boolean)])));
  };

  const removeSku = (row: SkuRow) => {
    if (noSpecMode) {
      setSkuRows([createBaseSkuRow({ ...row, skuName: "", skuImageUrl: "" })]);
      return;
    }
    const key = String(row.specKey || row.skuName || "");
    addRemovedSkuKeys([key]);
    setSkuRows(getSkuRows().filter(item => String(item.specKey || item.skuName || "") !== key));
  };

  const applyBatchSettings = () => {
    const rows = getSkuRows();
    if (!rows.length) return;

    const hasSalePrice = batchSalePrice !== null && batchSalePrice !== undefined && String(batchSalePrice) !== "";
    const hasStockQuantity = batchStockQuantity !== null && batchStockQuantity !== undefined && String(batchStockQuantity) !== "";

    if (!hasSalePrice && !hasStockQuantity) {
      message.warning("请至少填写一项批量设置");
      return;
    }

    if (hasSalePrice && !isTierPrice) {
      const price = Number(batchSalePrice);
      if (!(price > 0) || price > maxPrice) {
        message.warning("单价必须大于 0，且不能超过 99999.99");
        return;
      }
    }

    if (hasStockQuantity) {
      const stock = Number(batchStockQuantity);
      if (!Number.isInteger(stock) || stock < 1 || stock > maxStock) {
        message.warning("库存必须为 1 到 999999 的正整数");
        return;
      }
    }

    setSkuRows(
      rows.map(row => ({
        ...row,
        salePrice: hasSalePrice && !isTierPrice ? Number(batchSalePrice) : row.salePrice,
        stockQuantity: hasStockQuantity ? Number(batchStockQuantity) : row.stockQuantity
      }))
    );
    setBatchSalePrice(null);
    setBatchStockQuantity(null);
    message.success("批量设置已应用");
  };

  const ImageUploadTile = ({ value, onChange, variant = "sku" }: { value?: string; onChange: (url: string) => void; variant?: "sku" | "spec" }) => {
    const uploadProps = {
      beforeUpload: async (file: File) => {
        try {
          const dataUrl = await imageToCompressedDataUrl(file);
          onChange(dataUrl);
        } catch (error: any) {
          message.error(error.message);
        }
        return false;
      },
      showUploadList: false,
      accept: "image/*"
    };

    if (!value) {
      return (
        <Upload {...uploadProps}>
          <button type="button" className={`product-image-add-tile is-${variant}`}>
            <PlusOutlined className="product-image-add-icon" />
            <span className="product-image-add-label">添加图片</span>
          </button>
        </Upload>
      );
    }

    return (
      <div className={`product-image-preview-tile is-${variant}`}>
        <img src={value} alt="" />
        <div className="product-image-actions">
          <Tooltip title="删除">
            <Button type="text" icon={<DeleteOutlined />} onClick={() => onChange("")} />
          </Tooltip>
          <Tooltip title="预览">
            <Button type="text" icon={<ZoomInOutlined />} onClick={() => onPreviewImage(value)} />
          </Tooltip>
          <Upload {...uploadProps}>
            <Tooltip title="更换">
              <Button type="text" icon={<EditOutlined />} />
            </Tooltip>
          </Upload>
        </div>
      </div>
    );
  };

  const skuTextRules = (label: string) => [
    {
      validator: (_rule: unknown, value: unknown) => {
        const text = String(value || "");
        if (!text) return Promise.resolve();
        if (text.length > maxSkuTextLength) {
          return Promise.reject(new Error(`${label}不能超过 ${maxSkuTextLength} 位`));
        }
        return /^[0-9A-Za-z]+$/.test(text)
          ? Promise.resolve()
          : Promise.reject(new Error(`${label}只能输入字母或数字`));
      }
    }
  ];

  const priceRules = [
    { required: true, message: "请输入单价" },
    {
      validator: (_rule: unknown, value: unknown) => {
        const current = Number(value);
        if (!(current > 0)) return Promise.reject(new Error("单价必须大于 0"));
        if (current > maxPrice) return Promise.reject(new Error("单价不能超过 99999.99"));
        return Promise.resolve();
      }
    }
  ];

  const stockRules = [
    { required: true, message: "请输入库存" },
    {
      validator: (_rule: unknown, value: unknown) => {
        const current = Number(value);
        if (!Number.isInteger(current) || current < 1) return Promise.reject(new Error("库存必须为正整数"));
        if (current > maxStock) return Promise.reject(new Error("库存不能超过 999999"));
        return Promise.resolve();
      }
    }
  ];

  const minOrderRules = [
    { required: true, message: "请输入最小起订量" },
    {
      validator: (_rule: unknown, value: unknown) => {
        const current = Number(value);
        if (!Number.isInteger(current) || current < 1) return Promise.reject(new Error("最小起订量必须为正整数"));
        if (current > maxMinOrderQuantity) return Promise.reject(new Error("最小起订量不能超过 100"));
        return Promise.resolve();
      }
    }
  ];

  const columns: ColumnsType<SkuRow> = [
    ...activeGroups.map((group, groupIndex) => ({
      key: group.id,
      title: group.name || `规格${groupIndex + 1}`,
      width: 120,
      render: (_: unknown, row: SkuRow) => (
        <span className="product-spec-sku-spec-value">{row.specValues?.[groupIndex]?.value || "-"}</span>
      )
    })),
    {
      key: "skuCode",
      title: "SKU编码",
      width: 160,
      render: (_: unknown, __: SkuRow, index: number) => (
        <Form.Item
          name={["skuList", index, "skuCode"]}
          normalize={normalizeSkuText}
          rules={skuTextRules("SKU编码")}
          noStyle
        >
          <Input maxLength={maxSkuTextLength} placeholder="请输入SKU编码" />
        </Form.Item>
      )
    },
    {
      key: "skuBarcode",
      title: "SKU条码",
      width: 160,
      render: (_: unknown, __: SkuRow, index: number) => (
        <Form.Item
          name={["skuList", index, "skuBarcode"]}
          normalize={normalizeSkuText}
          rules={skuTextRules("SKU条码")}
          noStyle
        >
          <Input maxLength={maxSkuTextLength} placeholder="请输入SKU条码" />
        </Form.Item>
      )
    },
    {
      key: "salePrice",
      title: "单价",
      width: 140,
      render: (_: unknown, __: SkuRow, index: number) => (
        <Form.Item name={["skuList", index, "salePrice"]} rules={priceRules} noStyle>
          <InputNumber min={0.01} max={maxPrice} precision={2} step={0.01} placeholder="请输入单价" />
        </Form.Item>
      )
    },
    {
      key: "stockQuantity",
      title: "库存",
      width: 120,
      render: (_: unknown, __: SkuRow, index: number) => (
        <Form.Item name={["skuList", index, "stockQuantity"]} rules={stockRules} noStyle>
          <InputNumber min={1} max={maxStock} precision={0} placeholder="请输入库存" />
        </Form.Item>
      )
    },
    {
      key: "minOrderQuantity",
      title: `最小起订量（${minOrderUnitLabel || "件"}）`,
      width: 140,
      render: (_: unknown, __: SkuRow, index: number) => (
        <Form.Item name={["skuList", index, "minOrderQuantity"]} rules={minOrderRules} noStyle>
          <InputNumber min={1} max={maxMinOrderQuantity} precision={0} placeholder="最小起订量" />
        </Form.Item>
      )
    },
    {
      key: "skuStatus",
      title: "状态",
      width: 108,
      render: (_: unknown, __: SkuRow, index: number) => (
        <Form.Item name={["skuList", index, "skuStatus"]} noStyle>
          <Select options={[{ value: "ENABLED", label: "启用" }, { value: "DISABLED", label: "停用" }]} />
        </Form.Item>
      )
    },
    {
      key: "skuImageUrl",
      title: "SKU图片",
      width: 92,
      align: "center",
      render: (_: unknown, __: SkuRow, index: number) => (
        <Form.Item shouldUpdate noStyle>
          {() => (
            <>
              <Form.Item name={["skuList", index, "skuImageUrl"]} noStyle>
                <Input type="hidden" />
              </Form.Item>
              <div className="product-spec-sku-image-cell">
                <ImageUploadTile
                  value={form.getFieldValue(["skuList", index, "skuImageUrl"])}
                  onChange={url => form.setFieldValue(["skuList", index, "skuImageUrl"], url)}
                />
              </div>
            </>
          )}
        </Form.Item>
      )
    },
    {
      key: "action",
      title: "操作",
      width: 72,
      align: "center",
      render: (_: unknown, row: SkuRow) => (
        <Tooltip title="删除">
          <Button danger icon={<DeleteOutlined />} disabled={noSpecMode} onClick={() => removeSku(row)} />
        </Tooltip>
      )
    }
  ];

  const tableColumns: ColumnsType<SkuRow> = isTierPrice
    ? columns.filter(column => !["salePrice", "minOrderQuantity"].includes(String(column.key)))
    : columns;

  return (
    <section className="product-spec-editor">
      <div className="product-spec-editor-head">
        <div className="product-spec-editor-title">商品规格</div>
      </div>

      <div className="product-spec-group-list">
        {specGroups.map((group, groupIndex) => {
          const canAddValue = group.values.length < maxSpecValuesPerGroup;
          return (
            <div className="product-spec-group-card" key={group.id}>
              <div className="product-spec-group-head">
                <div className="product-spec-name-row">
                  <Select
                    showSearch
                    className="product-spec-name-input"
                    value={group.name || undefined}
                    placeholder="请选择规格类型"
                    optionFilterProp="label"
                    options={specTypeOptions.map(name => ({
                      value: name,
                      label: name,
                      disabled: name !== group.name && selectedSpecNames.includes(name)
                    }))}
                    onChange={value => updateGroupName(group.id, String(value || ""))}
                    dropdownRender={menu => (
                      <>
                        {menu}
                        <div className="product-spec-type-dropdown-footer">
                          {creatingGroupId === group.id ? (
                            <div className="product-spec-type-create-row">
                              <Input
                                value={creatingTypeName}
                                maxLength={20}
                                placeholder="请输入规格类型"
                                onChange={event => setCreatingTypeName(event.target.value)}
                                onPressEnter={() => void saveCreatedType(group.id)}
                              />
                              <Button
                                type="text"
                                icon={<CheckOutlined />}
                                loading={savingType}
                                onClick={() => void saveCreatedType(group.id)}
                              />
                              <Button type="text" icon={<CloseOutlined />} onClick={cancelCreateType} />
                            </div>
                          ) : (
                            <Button type="link" onClick={() => startCreateType(group.id)}>
                              创建类型
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  />
                </div>
                <Space className="product-spec-group-actions" split={<span className="product-spec-action-split">|</span>}>
                  <Button type="link" disabled={groupIndex === specGroups.length - 1} onClick={() => moveGroup(group.id, 1)}>
                    下移
                  </Button>
                  <Button type="link" disabled={groupIndex === 0} onClick={() => moveGroup(group.id, -1)}>
                    上移
                  </Button>
                  <Button type="link" danger onClick={() => removeGroup(group.id)}>
                    删除
                  </Button>
                </Space>
              </div>

              {group.name ? (
                <>
                  <div className="product-spec-value-grid">
                    {group.values.map(value => {
                      const isDragging = draggingValue?.groupId === group.id && draggingValue.valueId === value.id;
                      return (
                        <div
                          className={`product-spec-value-item${isDragging ? " is-dragging" : ""}`}
                          key={value.id}
                          onDragOver={event => {
                            if (!draggingValue || draggingValue.groupId !== group.id || draggingValue.valueId === value.id) return;
                            event.preventDefault();
                          }}
                          onDrop={event => {
                            event.preventDefault();
                            if (!draggingValue || draggingValue.groupId !== group.id) return;
                            moveValue(group.id, draggingValue.valueId, value.id);
                            setDraggingValue(null);
                          }}
                        >
                          <button
                            type="button"
                            className="product-spec-value-handle"
                            draggable={group.values.length > 1}
                            onDragStart={event => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", value.id);
                              setDraggingValue({ groupId: group.id, valueId: value.id });
                            }}
                            onDragEnd={() => setDraggingValue(null)}
                            aria-label="拖拽调整规格值顺序"
                          >
                            <HolderOutlined />
                          </button>
                          <Input
                            value={value.value}
                            maxLength={maxSpecValueLength}
                            placeholder={specPlaceholder(group.name, groupIndex)}
                            onChange={event => updateValue(group.id, value.id, event.target.value)}
                          />
                          <Tooltip title="删除规格值">
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => removeValue(group.id, value.id)}
                            />
                          </Tooltip>
                        </div>
                      );
                    })}
                    <div className="product-spec-card-footer">
                      <Button type="link" disabled={!canAddValue} onClick={() => addValue(group.id)}>
                        <PlusOutlined /> 添加规格值
                      </Button>
                      <span className="product-spec-card-tip">
                        已添加 {group.values.length} / {maxSpecValuesPerGroup} 个规格值
                      </span>
                    </div>
                  </div>

                </>
              ) : null}
            </div>
          );
        })}
      </div>

      <Button className="product-spec-add-group" disabled={specGroups.length >= maxSpecGroups} onClick={addGroup}>
        <PlusOutlined /> 添加规格类型（{specGroups.length}/{maxSpecGroups}）
      </Button>

      <div className="product-spec-sku-panel">
        <div className="product-spec-sku-head">
          <div className="product-spec-sku-title">SKU明细</div>
          <div className="product-spec-batch-bar">
            <span className="product-spec-batch-label">批量设置：</span>
            {!isTierPrice ? (
              <InputNumber
                className="product-spec-batch-input"
                min={0.01}
                max={maxPrice}
                precision={2}
                step={0.01}
                placeholder="单价"
                value={batchSalePrice}
                onChange={value => setBatchSalePrice(typeof value === "number" ? value : null)}
              />
            ) : null}
            <InputNumber
              className="product-spec-batch-input"
              min={1}
              max={maxStock}
              precision={0}
              placeholder="库存"
              value={batchStockQuantity}
              onChange={value => setBatchStockQuantity(typeof value === "number" ? value : null)}
            />
            <Button type="primary" onClick={applyBatchSettings} disabled={skuRows.length === 0}>
              确定
            </Button>
          </div>
        </div>
        {skuRows.length ? (
          <>
            {skuRows.map((row, index) => (
              <React.Fragment key={`sku-meta-${row.specKey || row.skuName || row.skuCode || index}`}>
                <Form.Item name={["skuList", index, "skuName"]} preserve noStyle>
                  <HiddenFormValue />
                </Form.Item>
                <Form.Item name={["skuList", index, "specKey"]} preserve noStyle>
                  <HiddenFormValue />
                </Form.Item>
                <Form.Item name={["skuList", index, "specValues"]} preserve noStyle>
                  <HiddenFormValue />
                </Form.Item>
                <Form.Item name={["skuList", index, "tierPrices"]} preserve noStyle>
                  <HiddenFormValue />
                </Form.Item>
              </React.Fragment>
            ))}
            <Table
              className="product-spec-sku-table"
              columns={tableColumns}
              dataSource={skuRows}
              pagination={false}
              rowKey={(row, index) => String(row.specKey || row.skuName || row.skuCode || `spu-${index}`)}
              scroll={{ x: Math.max(980, tableColumns.reduce((sum, column) => sum + Number(column.width || 100), 0)) }}
            />
          </>
        ) : (
          <Empty className="product-spec-empty" description="暂无 SKU，请先选择规格类型并填写规格值" />
        )}
      </div>
    </section>
  );
}
