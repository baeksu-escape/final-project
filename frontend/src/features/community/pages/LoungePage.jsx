import { useEffect, useState } from 'react'
import { Button, Card, Notice, Toast } from '../../../common/components/index.js'
import { createComment, createPost, deletePost, fetchPost, fetchPosts, updatePost } from '../api/boardApi.js'
import Pager from '../components/Pager.jsx'
import PostDetail from '../components/PostDetail.jsx'
import PostForm from '../components/PostForm.jsx'
import PostTable from '../components/PostTable.jsx'
import ReportModal from '../components/ReportModal.jsx'
import { PAGE_SIZE } from '../config/communityCodes.js'
import '../community.css'

// N-06 신용 라운지 — 글 목록·검색(N-06-1), 상세·댓글(N-06-1·3), 글쓰기(N-06-2), 내 글 수정·삭제(N-06-5·6),
// 글·댓글 신고(N-33-1)를 한 화면에서 목록 ↔ 상세 ↔ 쓰기·수정으로 바꿔 가며 보여 준다. 이름 대신 닉네임만 보인다.
export default function LoungePage() {
  // mode: list | detail | write | edit
  const [view, setView] = useState({ mode: 'list', postId: null })
  const [page, setPage] = useState(1)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState({ data: null, error: '' })
  const [detail, setDetail] = useState({ postId: null, post: null, error: '' })
  // 저장·삭제 뒤에 목록·상세를 다시 불러오려고 1씩 올린다
  const [listVersion, setListVersion] = useState(0)
  const [detailVersion, setDetailVersion] = useState(0)
  const [reportTarget, setReportTarget] = useState(null)
  // 이번에 신고한 대상('POST:12') — 버튼 대신 '신고함'을 보여 준다
  const [reportedKeys, setReportedKeys] = useState([])
  const [toast, setToast] = useState('')

  // 목록 — 쪽·검색어가 바뀌거나 저장·삭제 뒤에 다시 읽는다
  useEffect(() => {
    let alive = true
    fetchPosts({ page, keyword })
      .then((data) => alive && setList({ data, error: '' }))
      .catch((err) => alive && setList({ data: null, error: err.message }))
    return () => {
      alive = false
    }
  }, [page, keyword, listVersion])

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
  const toList = () => setView({ mode: 'list', postId: null })
  const openPost = (id) => setView({ mode: 'detail', postId: id })

  const handleSearch = (event) => {
    event.preventDefault()
    setPage(1)
    setKeyword(keywordInput.trim())
  }

  // N-06-2 글쓰기 → 쓴 글 상세로
  const handleCreate = async (values) => {
    const { postId: newId } = await createPost(values)
    setToast('글을 올렸습니다.')
    setListVersion((v) => v + 1)
    openPost(newId)
  }

  // N-06-5 내 글 수정 → 상세로
  const handleUpdate = async (values) => {
    await updatePost(postId, values)
    setToast('글을 고쳤습니다.')
    reloadAll()
    setView({ mode: 'detail', postId })
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
  } else if (view.mode === 'edit' && current.post) {
    body = <PostForm initial={current.post} onSubmit={handleUpdate} onCancel={() => setView({ mode: 'detail', postId })} />
  } else if (view.mode !== 'list') {
    body = current.error ? (
      <Card>
        <Notice type="warn">{current.error}</Notice>
        <div className="lounge-actions">
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
      />
    ) : (
      <p className="lounge-loading">불러오는 중…</p>
    )
  } else {
    const data = list.data
    const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1
    body = (
      <section className="card lounge-list" aria-labelledby="lounge-list-title">
        <div className="lounge-list__head">
          <h2 id="lounge-list-title" className="card__title">
            전체 글 {data && <span className="lounge-count">{data.totalCount}건</span>}
          </h2>
          <form className="lounge-search" onSubmit={handleSearch} role="search">
            <label htmlFor="lounge-search-input" className="lounge-sr-only">
              제목·내용 검색
            </label>
            <input
              id="lounge-search-input"
              className="text-input__control"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="제목·내용 검색 (예: DSR)"
            />
            <Button type="submit" size="sm">
              검색
            </Button>
          </form>
        </div>
        {list.error && <Notice type="warn">{list.error}</Notice>}
        {!data && !list.error && <p className="lounge-loading">불러오는 중…</p>}
        {data && (
          <>
            <PostTable items={data.items} startNo={data.totalCount - (data.page - 1) * PAGE_SIZE} onOpen={openPost} />
            <Pager page={data.page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </section>
    )
  }

  return (
    <div className="lounge-page">
      <div className="lounge-page__head">
        <div>
          <h1 className="lounge-page__title">신용 라운지</h1>
          <p className="lounge-page__lead">같은 고민을 가진 사람들과 이야기를 나눕니다. 이름 대신 닉네임으로 보이고, 문제 있는 글·댓글은 신고할 수 있습니다.</p>
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
    </div>
  )
}
