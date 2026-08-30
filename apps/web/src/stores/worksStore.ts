import { create } from 'zustand';
import type { WorkDto, WorkSort, WorksMatchingIdsResponse } from '@mira/contracts';
import { worksApi } from '../api/endpoints';

interface WorksState {
  works: WorkDto[];
  total: number;
  page: number;
  pageSize: number;
  sort: WorkSort;
  keyword: string;
  loading: boolean;
  fetchWorks: (opts?: { page?: number; sort?: WorkSort; keyword?: string; append?: boolean }) => Promise<void>;
  /** R5 跨页全选：查询匹配 id（不落全局 state，选择态是页面会话态） */
  fetchMatchingIds: (opts?: { sort?: WorkSort; keyword?: string; limit?: number }) => Promise<WorksMatchingIdsResponse>;
  getWork: (id: string) => WorkDto | null;
  updateWork: (id: string, data: { title?: string; canvasJson?: Record<string, unknown>; thumbnailUrl?: string | null }) => Promise<WorkDto>;
  removeWork: (id: string) => Promise<void>;
  duplicateWork: (id: string) => Promise<WorkDto>;
  reset: () => void;
}

export const useWorksStore = create<WorksState>((set, get) => ({
  works: [],
  total: 0,
  page: 1,
  pageSize: 12,
  sort: 'recent',
  keyword: '',
  loading: false,

  fetchWorks: async ({ page, sort, keyword, append = false } = {}) => {
    const current = get();
    const nextPage = page ?? current.page;
    const nextSort = sort ?? current.sort;
    const nextKeyword = keyword ?? current.keyword;

    set({ loading: true });
    try {
      const result = await worksApi.list({
        page: nextPage,
        pageSize: current.pageSize,
        sort: nextSort,
        keyword: nextKeyword,
      });
      set((state) => ({
        works: append ? [...state.works, ...result.items] : result.items,
        total: result.total,
        page: result.page,
        sort: nextSort,
        keyword: nextKeyword,
        loading: false,
      }));
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  getWork: (id) => get().works.find((w) => w.id === id) ?? null,

  fetchMatchingIds: async ({ sort, keyword, limit } = {}) => {
    const current = get();
    // 返回数据由调用方（GalleryPage 页面会话态）持有，不写全局 state
    return worksApi.matchingIds({
      sort: sort ?? current.sort,
      keyword: keyword ?? current.keyword,
      limit,
    });
  },

  updateWork: async (id, data) => {
    const updated = await worksApi.update(id, data);
    set((state) => ({
      works: state.works.map((w) => (w.id === id ? updated : w)),
    }));
    return updated;
  },

  removeWork: async (id) => {
    await worksApi.remove(id);
    set((state) => ({
      works: state.works.filter((w) => w.id !== id),
      total: Math.max(0, state.total - 1),
    }));
  },

  duplicateWork: async (id) => {
    const copy = await worksApi.duplicate(id);
    set((state) => ({ works: [copy, ...state.works], total: state.total + 1 }));
    return copy;
  },

  reset: () => set({ works: [], total: 0, page: 1, keyword: '', loading: false }),
}));
