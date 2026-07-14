import { ImageResponse } from 'next/og'

export const alt = 'Remove AI Flavor - Make AI text sound human'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

/**
 * 生成中英文页面共用的 Open Graph 分享图片。
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(135deg, #fafafa 0%, #e7e5e4 100%)',
          color: '#1c1917',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          padding: '72px',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
            maxWidth: '960px',
          }}
        >
          <div style={{ color: '#dc2626', display: 'flex', fontSize: 32, fontWeight: 700 }}>
            RAIF
          </div>
          <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, letterSpacing: '-3px' }}>
            Remove AI Flavor
          </div>
          <div style={{ color: '#57534e', display: 'flex', fontSize: 38 }}>
            Make AI text sound more human.
          </div>
        </div>
      </div>
    ),
    size,
  )
}
