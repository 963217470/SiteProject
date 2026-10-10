import { beforeEach,expect,it,vi } from 'vitest'
import { mount,flushPromises } from '@vue/test-utils'
import HomeCommunity from '../docs/.vitepress/theme/components/HomeCommunity.vue'
import { communityRequest } from '../docs/.vitepress/theme/lib/community-api.mjs'
vi.mock('../docs/.vitepress/theme/lib/community-api.mjs',()=>({communityRequest:vi.fn()}))
vi.mock('../docs/.vitepress/theme/components/HomeArticles.vue',()=>({default:{template:'<section>真实文章入口</section>'}}))
beforeEach(()=>{vi.clearAllMocks();window.__api={auth:{getUser:async()=>({data:{user:{id:'u'}}})}}})
it('uses published server artworks and opens their existing detail routes',async()=>{communityRequest.mockResolvedValue({items:[{id:'work',title:'真实作品',kind:'game',summary:'公开介绍',downloads:4}]});const view=mount(HomeCommunity);await flushPromises();expect(view.get('.home-work-grid a').attributes('href')).toBe('/games-tools/?id=work');expect(view.text()).toContain('真实作品');view.unmount()})
it('an unavailable artwork service never removes the article and task entrances',async()=>{communityRequest.mockRejectedValue(new Error('作品服务暂时不可用'));const view=mount(HomeCommunity);await flushPromises();expect(view.get('[role=alert]').text()).toContain('作品服务暂时不可用');expect(view.text()).toContain('真实文章入口');expect(view.find('a[href="/tasks/"]').exists()).toBe(true);view.unmount()})
it('signed-in daily check-in opens the shared dialog rather than creating a second reward flow',async()=>{communityRequest.mockResolvedValue({items:[]});const open=vi.fn();window.addEventListener('rd:checkin',open);const view=mount(HomeCommunity);await flushPromises();await view.findAll('button').find(b=>b.text()==='每日签到').trigger('click');await flushPromises();expect(open).toHaveBeenCalledTimes(1);view.unmount();window.removeEventListener('rd:checkin',open)})
