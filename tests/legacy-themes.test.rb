require "minitest/autorun"
require_relative "../scripts/legacy-themes"

class LegacyThemesTest < Minitest::Test
  def test_internal_paths_are_mounted_once
    assert_equal "/v1/", LegacyThemes.url("/")
    assert_equal "/v1/theme/Ash/?a=1#download", LegacyThemes.url("/theme/Ash/?a=1#download")
    assert_equal "/v1/assets/a.css", LegacyThemes.url("/v1/assets/a.css")
    assert_equal "/v1/?a=1", LegacyThemes.url("https://theme.typora.io/?a=1")
    assert_equal "/v1/theme/Ash/#download", LegacyThemes.url("//theme.typora.io/theme/Ash/#download")
  end

  def test_external_downloads_and_relative_resources_are_preserved
    %w[https://github.com/a/b/releases/download/v1/theme.zip //cdn.example.com/a.css mailto:hi@typora.io data:image/png;base64,AA ../fonts/a.woff #download].each do |url|
      assert_equal url, LegacyThemes.url(url)
    end
  end

  def test_gallery_navigation_images_and_metadata
    html = LegacyThemes.html(<<~HTML)
      <!DOCTYPE html><html><head><link href="/assets/a.css" rel="stylesheet"><meta name="twitter:image" content="/media/cover.png"></head>
      <body><a href="/theme/Ash/">Ash</a><img src="/media/a.png" srcset="/media/a.png 1x, /media/b.png 2x">
      <a href="https://github.com/a/b">Download</a><pre><code>&lt;img src="/example.png"&gt;</code></pre>
      <script>const path = "/unchanged";</script></body></html>
    HTML
    doc = Nokogiri::HTML(html)
    assert_equal "/v1/assets/a.css", doc.at_css("link")["href"]
    assert_equal "/v1/media/cover.png", doc.at_css('meta[name="twitter:image"]')["content"]
    assert_equal "/v1/theme/Ash/", doc.at_css("a")["href"]
    assert_equal "/v1/media/a.png", doc.at_css("img")["src"]
    assert_equal "/v1/media/a.png 1x, /v1/media/b.png 2x", doc.at_css("img")["srcset"]
    assert_equal "https://github.com/a/b", doc.css("a").last["href"]
    assert_equal '<img src="/example.png">', doc.at_css("code").text
    assert_equal 'const path = "/unchanged";', doc.at_css("script").content
  end

  def test_css_urls_in_stylesheets_and_inline_styles
    css = 'a { background: url("/media/a.png"); } @import "/assets/b.css"; b {src: url(../fonts/a.woff)}'
    result = LegacyThemes.css(css)
    assert_includes result, 'url("/v1/media/a.png")'
    assert_includes result, '@import "/v1/assets/b.css"'
    assert_includes result, 'url(../fonts/a.woff)'
    doc = Nokogiri::HTML(LegacyThemes.html('<style>a {background: url(/media/a.png)}</style><div style="background: url(/media/b.png)"></div>'))
    assert_includes doc.at_css("style").content, "url(/v1/media/a.png)"
    assert_includes doc.at_css("div")["style"], "url(/v1/media/b.png)"
  end

  def test_upstream_https_redirect_allows_local_preview
    doc = Nokogiri::HTML(LegacyThemes.html('<script>if (window.location.protocol != "https:") { window.location.protocol = "https"; }</script>'))
    assert_includes doc.at_css("script").content, 'includes(window.location.hostname)'
    assert_includes doc.at_css("script").content, 'window.location.protocol = "https";'
  end

  def test_v1_header_shares_the_version_menu_and_keeps_v2_at_the_root
    input = '<html><head></head><body><header id="header"><div class="gallery"><div class="product-name">Typora</div><ul class="pure-menu-list"><li><a href="/doc">Documents</a></li></ul></div></header></body></html>'
    doc = Nokogiri::HTML(LegacyThemes.html(input))
    assert_equal "Typora", doc.at_css(".legacy-version-brand .product-name").text
    assert_equal "1.0", doc.at_css(".version-switcher summary span").text
    assert_equal [["2.0 beta", "/"], ["1.0", "/v1/"]], doc.css(".version-options a").map { |a| [a.text, a["href"]] }
    assert_equal "1.0", doc.at_css('.version-options [aria-current="true"]').text
    assert_equal "/v1/doc", doc.at_css(".pure-menu-list a")["href"]
    assert_equal "/v1/assets/version-switcher.css", doc.at_css("link")["href"]
    assert_equal "/v1/assets/version-switcher.js", doc.at_css("script[src]")["src"]
  end

  def test_detail_header_keeps_back_link_and_has_a_version_menu
    doc = Nokogiri::HTML(LegacyThemes.html('<html><head></head><body><header id="header"><div class="gallery"><ul class="pure-menu-list"><li><a href="/">Back</a></li></ul></div></header></body></html>'))
    assert_equal "/v1/", doc.at_css(".pure-menu-list a")["href"]
    assert doc.at_css(".legacy-version-only .version-switcher")
    assert_equal "/", doc.at_css(".version-options a")["href"]
  end
end
