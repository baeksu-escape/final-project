import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Notice, SegmentedControl, Toast } from '../../../common/components/index.js'
import { createComment, createPost, deleteComment, deletePost, fetchMyComments, fetchPost, fetchPosts, updateComment, updatePost } from '../api/boardApi.js'
import MyCommentTable from '../components/MyCommentTable.jsx'
import Pager from '../components/Pager.jsx'
import PostDetail from '../components/PostDetail.jsx'
import PostForm from '../components/PostForm.jsx'
import PostTable from '../components/PostTable.jsx'
import ReportModal from '../components/ReportModal.jsx'
import { PAGE_SIZE, POST_CATEGORIES } from '../config/communityCodes.js'
import '../community.css'

// 조회 범위 버튼(제목 아래) — query를 서버에 보내 전체 글에서 고른다(COMM-01, FP-279). label은 목록 제목으로도 쓴다
const COMMENTS_TAB = 'comments'
const LIST_TABS = [
  { key: 'all', label: '전체 글', query: {} },
  { key: 'mine', label: '내 글', query: { filter: 'mine' } },
  // 내가 쓴 댓글(COMM-09)은 글 목록 대신 내 댓글을 따로 읽는다
  { key: COMMENTS_TAB, label: '내가 쓴 댓글' },
]
const VIEW_OPTIONS = LIST_TABS.map((tab) => ({ value: tab.key, label: tab.label }))
const tabOf = (key) => LIST_TABS.find((tab) => tab.key === key)

// FP-223 주소(?post=3, ?post=3&mode=edit, ?mode=write)에서 지금 볼 화면을 읽는다. 번호가 이상하면 목록으로 본다.
function readView(params) {
  const postId = Number(params.get('post'))
  const mode = params.get('mode')
  if (Number.isInteger(postId) && postId > 0) return { mode: mode === 'edit' ? 'edit' : 'detail', postId }
  return { mode: mode === 'write' ? 'write' : 'list', postId: null }
}

// FP-223 화면 → 주소 쿼리. 목록은 쿼리 없이 /lounge.
function toSearch({ mode, postId }) {
  if (mode === 'write') return { mode: 'write' }
  if (mode === 'edit') return { post: String(postId), mode: 'edit' }
  if (mode === 'detail') return { post: String(postId) }
  return {}
}

// N-06 신용 라운지 — 글 목록·검색(N-06-1), 내가 쓴 댓글(COMM-09), 상세·댓글(N-06-1·3), 글쓰기(N-06-2), 내 글 수정·삭제(N-06-5·6), 내 댓글 수정·삭제(COMM-10·11),
// 글·댓글 신고(N-33-1)를 한 화면에서 목록 ↔ 상세 ↔ 쓰기·수정으로 바꿔 가며 보여 준다. 이름 대신 닉네임만 보인다.
export default function LoungePage() {
  // mode: list | detail | write | edit — 주소에 남겨 브라우저 뒤로가기가 라운지 안에서 한 단계씩 돌아가게 한다(FP-223)
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const view = readView(searchParams)
  const [page, setPage] = useState(1)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  // 글 카테고리 필터(보기 4개가 함께 쓴다). ''이면 전체
  const [category, setCategory] = useState('')
  // key: 어떤 조건(탭·쪽·검색어·카테고리)으로 읽은 목록인지 — 지금 조건과 다르면 흐리게(누를 수 없게) 두고 '불러오는 중'을 보여 준다
  const [list, setList] = useState({ key: null, data: null, error: '' })
  const [detail, setDetail] = useState({ postId: null, post: null, error: '' })
  // 저장·삭제 뒤에 목록·상세를 다시 불러오려고 1씩 올린다
  const [listVersion, setListVersion] = useState(0)
  const [detailVersion, setDetailVersion] = useState(0)
  const [reportTarget, setReportTarget] = useState(null)
  // 이번에 신고한 대상('POST:12') — 버튼 대신 '신고함'을 보여 준다
  const [reportedKeys, setReportedKeys] = useState([])
  const [toast, setToast] = useState('')
  const [feedTab, setFeedTab] = useState('all')
  const [commentPage, setCommentPage] = useState(1)
  const [myComments, setMyComments] = useState({ key: null, data: null, error: '' })

  const commentsOpen = feedTab === COMMENTS_TAB
  const listKey = JSON.stringify([feedTab, page, keyword, category])
  const commentKey = JSON.stringify([commentPage, keyword, category])
  // 목록 — 탭·쪽·검색어·카테고리가 바뀌거나 저장·삭제 뒤에 다시 읽는다. 지워서 마지막 쪽이 비었으면 앞쪽으로 옮긴다.
  useEffect(() => {
    if (feedTab === COMMENTS_TAB) return undefined
    let alive = true
    fetchPosts({ page, keyword, category, ...tabOf(feedTab).query })
      .then((data) => {
        if (!alive) return
        if (data.items.length === 0 && page > 1) setPage(page - 1)
        else setList({ key: listKey, data, error: '' })
      })
      .catch((err) => alive && setList({ key: listKey, data: null, error: err.message }))
    return () => {
      alive = false
    }
  }, [feedTab, page, keyword, category, listKey, listVersion])

  // 내가 쓴 댓글 — 탭을 열거나 쪽·검색어·카테고리가 바뀌거나 댓글을 쓰고 고치고 지운 뒤에 다시 읽는다
  useEffect(() => {
    if (!commentsOpen) return undefined
    let alive = true
    fetchMyComments({ page: commentPage, keyword, category })
      .then((data) => {
        if (!alive) return
        if (data.items.length === 0 && commentPage > 1) setCommentPage(commentPage - 1)
        else setMyComments({ key: commentKey, data, error: '' })
      })
      .catch((err) => alive && setMyComments({ key: commentKey, data: null, error: err.message }))
    return () => {
      alive = false
    }
  }, [commentsOpen, commentPage, keyword, category, commentKey, listVersion])

  // 상세 — 고른 글이 바뀌거나 댓글·신고 뒤에 다시 읽는다
  const postId = view.postId
  useEffect(() => {
    if (postId == null) return undefined
    let alive = true
    fetchPost(postId)
      .then((post) => alive && setDetail({ postId, post, error: '' }))
      .catch((err) => alive && setDetail({ postId, post: null, error: err.message }))
    return () => {
      alive = false
    }
  }, [postId, detailVersion])

  const reloadAll = () => {
    setListVersion((v) => v + 1)
    setDetailVersion((v) => v + 1)
  }
  // 라운지 안에서 화면을 옮긴다. 새 기록에는 inLounge 표시를 남기고, 덮어쓸 때는 지금 기록의 표시를 그대로 둔다.
  const setView = (next, replace = false) =>
    setSearchParams(toSearch(next), { replace, state: replace ? location.state : { inLounge: true } })
  // [목록으로]·[취소]·저장·삭제 뒤 — 라운지 안에서 왔으면 실제 뒤로가기(지나온 화면이 앞으로 가기 쪽에 남는다),
  // 주소로 바로 들어왔으면 지금 기록을 fallback 화면으로 덮어쓴다.
  const goBack = (fallback) => (location.state?.inLounge ? navigate(-1) : setView(fallback, true))
  const toList = () => goBack({ mode: 'list', postId: null })
  const openPost = (id) => setView({ mode: 'detail', postId: id })

  // 탭을 바꾸면 첫 쪽부터 본다
  const handleTab = (key) => {
    setFeedTab(key)
    setPage(1)
    setCommentPage(1)
  }

  const handleSearch = (event) => {
    event.preventDefault()
    setPage(1)
    setCommentPage(1)
    setKeyword(keywordInput.trim())
  }

  // 카테고리를 고르면 바로 첫 쪽부터 다시 읽는다
  const handleCategory = (code) => {
    setPage(1)
    setCommentPage(1)
    setCategory(code)
  }

  // N-06-2 글쓰기 → 쓴 글 상세로 (글쓰기 기록을 덮어써 뒤로가기로 빈 글쓰기 화면에 돌아가지 않는다)
  const handleCreate = async (values) => {
    const { postId: newId } = await createPost(values)
    setToast('글을 올렸습니다.')
    setListVersion((v) => v + 1)
    setView({ mode: 'detail', postId: newId }, true)
  }

  // N-06-5 내 글 수정 → 상세로
  const handleUpdate = async (values) => {
    await updatePost(postId, values)
    setToast('글을 고쳤습니다.')
    reloadAll()
    goBack({ mode: 'detail', postId })
  }

  // N-06-6 내 글 삭제 → 목록으로
  const handleDelete = async () => {
    try {
      await deletePost(postId)
      setToast('글을 삭제했습니다.')
      setListVersion((v) => v + 1)
      toList()
    } catch (err) {
      setToast(err.message)
    }
  }

  // N-06-3 댓글 쓰기
  const handleAddComment = async (content) => {
    await createComment(postId, content)
    reloadAll()
  }

  // N-06 내 댓글 수정(COMM-10)
  const handleSaveComment = async (commentId, content) => {
    await updateComment(postId, commentId, content)
    setToast('댓글을 고쳤습니다.')
    reloadAll()
  }

  // N-06 내 댓글 삭제(COMM-11)
  const handleDeleteComment = async (commentId) => {
    await deleteComment(postId, commentId)
    setToast('댓글을 삭제했습니다.')
    reloadAll()
  }

  // N-33-1·2 신고 접수 — 기준 건수가 차서 숨겨졌으면 그렇게 알려 준다
  const handleReported = (result) => {
    const key = `${reportTarget.targetType}:${reportTarget.targetId}`
    const kind = reportTarget.targetType === 'POST' ? '글' : '댓글'
    setReportedKeys((keys) => [...keys, key])
    setReportTarget(null)
    setToast(result.targetHidden ? `신고를 접수했습니다. 신고가 쌓여 ${kind}을 자동으로 숨겼습니다.` : '신고를 접수했습니다. 관리자가 확인합니다.')
    if (result.targetHidden) reloadAll()
  }

  const current = detail.postId === postId ? detail : { post: null, error: '' }
  let body
  if (view.mode === 'write') {
    body = <PostForm onSubmit={handleCreate} onCancel={toList} />
  } else if (view.mode === 'edit' && current.post?.mine && !current.post.hidden) {
    // 주소를 직접 쳐서 남의 글·숨김 글의 수정 화면으로 오면 아래 상세로 보여 준다(저장은 서버도 막는다)
    body = <PostForm initial={current.post} onSubmit={handleUpdate} onCancel={() => goBack({ mode: 'detail', postId })} />
  } else if (view.mode !== 'list') {
    body = current.error ? (
      <Card>
        <Notice type="warn">{current.error}</Notice>
        <div className="l-row">
          <Button size="sm" onClick={toList}>
            목록으로
          </Button>
        </div>
      </Card>
    ) : current.post ? (
      <PostDetail
        post={current.post}
        reportedKeys={reportedKeys}
        onBack={toList}
        onEdit={() => setView({ mode: 'edit', postId })}
        onDelete={handleDelete}
        onReport={setReportTarget}
        onAddComment={handleAddComment}
        onSaveComment={handleSaveComment}
        onDeleteComment={handleDeleteComment}
      />
    ) : (
      <p className="hint">불러오는 중…</p>
    )
  } else {
    // 지금 조건으로 읽은 결과가 아니면(ready가 거짓) 앞 목록을 흐리게 두고 누를 수 없게 한다 — 목록이 사라졌다 나오면 화면이 끊겨 보인다
    const loaded = commentsOpen ? myComments : list
    const ready = loaded.key === (commentsOpen ? commentKey : listKey)
    const { data, error } = loaded
    const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1
    body = (
      <section className="card lounge-list" aria-labelledby="lounge-list-title">
        <div className="lounge-list__head">
          <h2 id="lounge-list-title" className="card__title">
            {tabOf(feedTab).label} {ready && data && <span className="lounge-count">{data.totalCount}건</span>}
          </h2>
          <form className="lounge-search" onSubmit={handleSearch} role="search">
            <label htmlFor="lounge-search-input" className="sr-only">
              {commentsOpen ? '댓글·게시글 제목 검색' : '제목·내용 검색'}
            </label>
            <input
              id="lounge-search-input"
              className="text-input__control"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder={commentsOpen ? '댓글·게시글 제목 검색' : '제목·내용 검색 (예: DSR)'}
            />
            <Button type="submit" size="sm">
              검색
            </Button>
          </form>
        </div>
        {/* 위 줄은 조회 범위(공통 SegmentedControl), 아래 줄은 카테고리 작은 버튼(고른 것은 aria-pressed) */}
        <div className="lounge-filters">
          <div className="lounge-view-row">
            <SegmentedControl label="조회 범위" options={VIEW_OPTIONS} value={feedTab} onChange={handleTab} />
          </div>
          <div className="lounge-cats" role="group" aria-label="카테고리">
            {[{ value: '', label: '전체' }, ...POST_CATEGORIES].map((item) => (
              <button key={item.value} type="button" aria-pressed={category === item.value} className="lounge-cats__btn" onClick={() => handleCategory(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="lounge-results" aria-busy={!ready}>
          {!ready && (
            <p className="hint lounge-results__loading" role="status">
              불러오는 중…
            </p>
          )}
          {ready && error && <Notice type="warn">{error}</Notice>}
          {data && (
            <div className="lounge-results__body" inert={!ready}>
              {commentsOpen ? (
                <MyCommentTable items={data.items} searched={Boolean(keyword || category)} onOpen={openPost} />
              ) : (
                <PostTable items={data.items} startNo={data.totalCount - (data.page - 1) * PAGE_SIZE} onOpen={openPost} />
              )}
              <Pager page={data.page} totalPages={totalPages} onChange={commentsOpen ? setCommentPage : setPage} />
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-head__title">신용 라운지</h1>
          <p className="page-head__lead">같은 고민을 가진 사람들과 이야기를 나눕니다. 이름 대신 닉네임으로 보이고, 문제 있는 글·댓글은 신고할 수 있습니다.</p>
        </div>
        {view.mode === 'list' && (
          <Button variant="primary" onClick={() => setView({ mode: 'write', postId: null })}>
            글쓰기
          </Button>
        )}
      </div>
      {body}
      {reportTarget && (
        <ReportModal key={`${reportTarget.targetType}:${reportTarget.targetId}`} target={reportTarget} onClose={() => setReportTarget(null)} onDone={handleReported} />
      )}
      <Toast message={toast} onClose={() => setToast('')} />
    </>
  )
}
