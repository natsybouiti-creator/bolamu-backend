const https = require('https');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '../public/images/landing');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const images = [
  { name: '01-logo-navbar.png', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBeCCL6AMGu54Q5GxYJ1RpWi5_g05-0b-xYMSPZOU2FXukyf29Xj_1kLmH4hXCsnuR4wShtaNoDXEmugnCOruQRB7YwhCWTcVRsGQKVE4ghzdblq3vGMvXKloKuHgRCmxonRA6F5ESt6gfZwL-QafTW2cvvH3FSWBr_f91b6nep0vYjraxPnMR3gN8sMJYH8ykizQ7bzU7xoK9TaenuViYkaRj_fXFlI7jbOmlcutrAsweBgfPjbhCwZEqn6RpxdY6IHaZ6HavK0B1j' },
  { name: '02-hero-femme.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLuOf4UCjsL_9Vy5_RNpzBPYe_GWRNJjPtEh6KcHOwDjQ8bZm_ZhPfdD7-0xKNcLGC82K6xycc9ZZXnaPT0_a1SJNCqtqod66YoVvnZIevFnNkzTIWeFHn450Jv8RvA4QmbFzB0OJ9JnqmaMVKSOMTGiHzojGpRJuGL9G69SstNzccXrLhcIR5SkJYwLLr3h8VyEb82r6qQoKLmDqd6J8-XpLDXa7TXxi-vUyW05UC9AmpLG-TFvpGS5Mj7S' },
  { name: '03-step-1-compte.jpg', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCuMDgQAVq0ubJydbks5pk0CI60DFtaiV-DsgYXF9oXrMVWQ3QW-yWp7Yfjy5jbR8KnpVEMKcKBcpAhCGSgkKsWn04T4X7iv0QLpS7R6mMrWkhRFV1U9jV3diN6C2ujfo2Umhj1BWdE1Fc9QBFLo3gsT2UrwPpceTG-4Okw0WRM0vw45Uv_5U2pgwunyH-WQlvcRB--TPV3RWQ3kWpbM8ZMen8YRO0MYu7ahPfJQpLjrYklWfGRWoqsuf9iOia_gp-o_l9DSUAi_KFX' },
  { name: '04-step-2-formule.jpg', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpzkW2GT5ra85c0203vb89ZjqnAK2oJ9GHkDomF3ujCNoPbPb3MWQY-OkIG73BWCiQF8xMXdpZr4jJv6bbSAOUCB1Mf6ERLGs266kUD4F4vOulZyayLyDL2GPhE9FTSomnZYMwQ1iRYh40wvB-EAIQsM3zlYFBws0eiujQrejuBqB2NDkbuhk__vyh7WdpvGbu5KtkJ1vZuZfwXQvWOpwg8Zj_LblsZDA3AHSmLN7sKvcepFKvK0baKyjW3wWVHeDtoJ6cuMDMR9yU' },
  { name: '05-step-3-soins.jpg', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1ai6yfRwwSsRaowQdmV0bsTIWATgyZyn2iA-XhwGQMJjriScgSjvFg2KoMZUtyPVAjtAvlC2Z6rd5_aoz1yEDz9PoGv2iIkI6aDrjwJ95vIQpdY--hrXf5l1tbvb4dnTWUIfiEaM7REElgoqw4PqdLCpUHhJ0ZiPgopC4qcpFKm4IblyJookg1pyM35ORLcCw34_Js5fk0K0H44htj-YgVIM6KMKdsRp23nP4DTP1-0O4izqa7aB4g-30MeZUEx_k5lTxTzF-9ZiO' },
  { name: '06-solution-familles.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLuENJlrrrXu5K-DmGf_0uD0ntZPMEyv-sgelUlXSYo-9io3JVTtXXVnOUfIORyYk3E645BeNK4Qkzg72mDXSOHnDDFbJr8dWDDe0BnPGY40O1T5YIv_dDBufQpWXSMXaKRHHeoFC_IRPqAoQK_BR1-RwzGbuveb9rKU6KKV6zYIOxGbcwZXfIcKyaFGlQgYFPFYoUHjdsdsrdhMzcvMf3MT5Nmqggv5OBzU7_h9gG0TAzXJ_OWbMlDUruaf' },
  { name: '07-solution-syndicats.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLv_DdtdRl1Ov5h4bNB5AYrLuEn41tcAcS3FjUCiw9PKOUV9EN8Ioen_HBhzhvdVFZpUdJTmCEH3aWkOqYOsIImt9faLg9RQ1yGsKm4J_dW25B8ccw6AWlLDs1eGJEchCkBYwKUQwLQJvEDw11abCtfrNLFU1lDhz_UDlydTWXmZDTna-MWiMnHGIH8OU4XnSU0LFhkQ9zb-BIK-RCGst-W2DHIUtH6WKaLJf9MHxCWWCiLYGgOvEfQAWUEa' },
  { name: '08-solution-pme.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLsUSn13QimIlqYEDFic-GX1mq9cTnAdwJS1FHCytPEyWPjP3345FcvSSqa_DmTA-uneCATaIht1_YD6MTXzERkuw0YGx6eQ_4LojksSJrCmBUQ1Hk33CqkU-Qy_OlW8H12LmnBPUK57CN5uFjbL7hPR7bFtXA5QkSk1bWU34HzOFUPgRurXuPPp8hchKJjVfrVOF3mCClfsyguYuf2wfLhP5-ZoWm9fl2r-kOdTexEuR0KhQrX8dwRwmU33' },
  { name: '09-solution-entreprises.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLuRYSPZVbth0WU0B5jYBWpJ9-IY1A-lu8AnvswgUBB6ohKs-EeaFEZHKRKHpLK_TY65AQ71z4Z5n0rzW8Ogofm4TmJ1Z3VbRBQTouFnJ5gBwOZW20SAdpYHxCcj7xJ0VwNjEC7ma18R4VRXjr_m8tljNlsNN2Tf8UEAOIeKtXqxdy7HRrtTOE3JZ8-yjbdFyTX5TbAV1y0iORFcIXXEVkCzmjD3o5KwxZQMunzZ8ajO7LP_8rBT3FciRHAb' },
  { name: '10-zora-voyages.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLv-KGD3XqcYjhW3wxOxxzbweqmxxnWZXW9RqBY9uFNcPj76YIcBi1AhqpxpYoo0LVGT06DkwQLMihCZpPI1zg1oq8J6SUKEVp5cOAPpzf5WFz4MayK_henNdpgS4Bx6QyTFHNS7hWVFtU-HuZmYDis8hK01JdafUNZZy3hFdHxn20_KURJUs3sWZQFQeLxNIBIuZRfvccIiIUiJ_GcQiLO7Ie3sG4AbRWxsjlq3N-HU52Icd5Y_L2FwrQ0u' },
  { name: '11-zora-telecom.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLtpUhDeXT_neqEXk5pvMx9JAucSKzkRhlG1YtuUCOPzQrlJO2CFoT0HDE3DXR-P7ACBkHhUebcj_Pw6USi1lW1TMkCLsHQUkTfLxV_OYviy0Y8hEUHVuup3BWMQwGq8UcHpmLqO3QifCXiS3CuT4eF1CLzEUuG-v-CwFonI99xDt24ob09tVwL877HBdPj_Pzzs-EPLZlB7PlCLjinBLX71lE7l0SkCeUDYLhZF9xt4BWSl1KYaDHLzIaM' },
  { name: '12-zora-hotels.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLup6OiOByNOr1oRkxEF0tYA_84k0ePOmZbjlfQD8Bgm0bH92jVsbb1LT7tehn7zN5nS7w2JTIOv8mmKub0PpL62DgiQ_fPbZEb1un6WmQJ9WGF75iK8s26IaXcM2Fx1Tfl-dmjw6j9UbkLSV5PuB0aDrweuNQyk1Qb3ihLtodZyvEzzmhpUBw4mefUbz8ikR32WH6Y_UxFBTHvlguVyqZCmGE-fe0ChlEpEBoZKZzPyVvsnfmtQzLqbYO0' },
  { name: '13-zora-sport.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLvq6BDfTwSK06FpLd_xgLYfhEmeNxYq6oDEdZzk6RM1SnY2HOeIiNFCiMNLTGeKkxHhsoBajDc0wrHUVsqNPN-sXBHCsNEn5ifB1dqbYUdjOCNDwb9M5uabKyxbL7hPR7bFtXA5QkSk1bWU34HzOFUPgRurXuPPp8hchKJjVfrVOF3mCClfsyguYuf2wfLhP5-ZoWm9fl2r-kOdTexEuR0KhQrX8dwRwmU33' },
  { name: '14-elonga-fitness.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLtnX-00o9bwDLXpXfPp7BKFru_c1cjI8pGDCNfkpmk1eJm2OVNcwIIVxQyoYsGYyQ-Hl4zJcQV-UTgHvfJOaL0SVT9Kbxb_Lnh-wnii1ivZbmjFptFsIdXaKP98E__A0nAuK0rd_J0QWrujXYt_fpqfoU16tygSf0rsuNodi7Ccf2TPPYY6Oye-Ufl4S8gLxuHYNot1rXEGSwTD02LNl9_XpfR6H5DYFZoQwD9ktOgT9xJmTUF7qO7Vbkl0' },
  { name: '15-elonga-temoignage.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLsH9MAcG81NdNYQU29GDHT0t87MXD775S7xXsrxc6J4-7DiRDzmpKg2fgr88DJ7rvCdLC2-2owieh2EzryVqP31JIyeukB4-0mAhrapCHUEtbfCEqDMyuQbfDoEvIyJ13zYhpvq8fxgfAsE4RTa8OSbfyTIENAKyZEJA-DEMNQk0h84HzI-cs8x0mFqjjsS5d6awEpPcxKt6KD02vF4ADvhsugN3jFL5rCst4EtAq2ntyo5fNgR47k4OVE' },
  { name: '16-reseau-cliniques.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLvvZzLWwr0zH3eIIWefsipudsR75Ue6iOLe5daMgxTofagI9P74g1Evi4A5vSjSs1p2CI8yvsjscodQ-YJ_Ee1KFbR9NlLyA0bBO5gbcAeXM24Mw5b6GkCSuFsRwu9r2NF7D-DEFU_uHgN3WDLv3JQR5-EGicGCurZkaKrtKABgrKbwE7OF99Aw4_b_IWpwpxb5FS8G2bjPC7AuJoquQngmWkWI1ftPYFpmPgqr_w4nzNNE9kSExD5CerpI' },
  { name: '17-reseau-pharmacies.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLvqT8j4Z5MjKdKb7EWOP0cTWIgA18MH5ks8zJecfXV9Za-u0cZHKmL85VMJ3LJmibDrMUrbXPpSoK__iUmqMJlRS8CcHRPukmASS8sHBvGqdg6HJsDcyqkSFF0YfhU9j7cUFIKIPnLbFi7NATdEqR5HwQrl-EqS5NkY416AKUqqc-NHH_DqYsJa6zr6yvRQEC3j_48PR9-Th-m744BOAq4U7i-A0EPc8933ug7VmuUbFdi7U2gV3Y4e6UUY' },
  { name: '18-reseau-laboratoires.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLuX6UjxIfG2XcHJ1s2gj53pTweNwVrRHCkXzEyor-LJ4JyqJEyca0B30CgL6ikA0mVVfTcjYfZfx-ML3MDUJUZScO0b6pBa3xr4ciIWk20N6PjJ6tFVeMRnRs6oa7e5SOA3dB4I1dQr_G11V9SS5yvwyO7GtLJ' },
  { name: '19-blog-nutrition.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLuJDuZpwtyHxctZ4WbWmLcQC5zwLbjJfUyY9gZfbNtjrVsHAlmB0GBjLeeeYZ86dtkGnmswENNZ6qRXPc28DeKUpOFAhgRb40Oyg4TdN_ldhUNYH7V4kNa4R8r_KVkDtsFZvh-fiVN6wGVFPNuImMgpmb7rdIBoDRyDG9vc1GZZYdIJp_SPWmLRPo_STt71FKTjhBx_0NuNaLCDgpvsWyqoRIA5KiO_HIliC91I7sGISbEGGFKSrOiYLmU' },
  { name: '20-blog-bienetre.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLtO3Zz6qxBMqpYMufeYFi_gXbGRsMz7YwEVvhiikI_P4hB6g3IsGg7m9fpOZVTk5zyPfCzXIxDgOYTIA4AjyEvBHqSyvShBfjJonK_dJyWsfWv4V1--4rYhRskQzTKgfZdIilwdJw8P84HRgUAYH6ji35WtTdOED7Qdf2HumknSg-7EeRuYzmA4S8dyfdwY7Rna06zMcv7EfNl5RrdDuldNEG79Tl0zhbEhdr9WwLKfVCa0iLXOQC5a_ntY' },
  { name: '21-blog-technologie.jpg', url: 'https://lh3.googleusercontent.com/aida/AP1WRLsJLGWiZvh6E6FLaPtsvrt-zIro3T-zt-JlhZNefFVJLhzJN63RKqygzHDxoUtPzOl4Q1ElLEhHktiMPBScR62Q31WtbDMNzeporJeeBtVx7s_1fCXomGpe6EUg0A1T4FQaMjnNBfELqYbvzuOR9CyO_N9ZxHnn-Hp7ogtyFZ3XOd3iDWrq7SIU6riu5CVO902rjRTpFFSFRfmzR5tZmdGZpNdyTAgIiaMwR' },
  { name: '22-carte-pointe-noire.jpg', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAoa6tJSyxT3A3ubK4ujSGr21PXV55LC8bn8AgiTxXNgcTJCuD-zljS51o2bzOJH4FNNxjOKrb_0JmMevmuRVG-qAaDEXknFl6kQUovrn8ztpDESwCXWrUiLMiLgnzzsL0nUsQiIEOSbUX2cnhKpaCMGBOgHhF_1QbamCIiDlt9lQOo4ZtmiP_4ApnbShye-60sHcTE8ERh1xLDTXqiTQxRAPHgrFoPcain_LXYFB6-XUGeod49-G8F66QYUxDiwLlvUFa9Tq01H0tI' },
  { name: '23-logo-footer.png', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDiZuz9itFPgWyGdhEHxd5vsIEG5xWtw_iP0s2hnt3UQyqqxwyomSamLUg-jwBG8-iJIqZ2XDBF5j2sPLDg_cj5NOBFRcN7waQu5_stbnaMVhD9htIQX3_LjXwVZewt2gIfJ4nA9DjxTgpmFss7oDeClbSEckGb6yFBUQl0qFNu23sUZoWJ6yXUXyN5OHkexSGQ4wqRzQuo2c8RbHzZDVQ1wU07pa5Jrvn2mgW1TOUT2LzMyxJuDMUjAEtUU03rsCvbbHPCy4IY8Ywn' }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, r => r.pipe(file));
        file.on('finish', () => { file.close(); resolve(); });
      } else {
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }
    }).on('error', reject);
  });
}

(async () => {
  for (const img of images) {
    const dest = path.join(outputDir, img.name);
    try {
      await download(img.url, dest);
      console.log('✓', img.name);
    } catch(e) {
      console.error('✗', img.name, e.message);
    }
  }
  console.log('Terminé.');
})();
