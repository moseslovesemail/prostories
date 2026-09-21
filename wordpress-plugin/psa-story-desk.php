<?php
/**
 * Plugin Name: PSA Story Desk
 * Description: Human-moderated editorial queue for Pro Stories Aotearoa.
 * Version: 0.1.0
 * Author: Pro Stories Aotearoa
 */

if (!defined('ABSPATH')) {
    exit;
}

const PSA_CANDIDATE_POST_TYPE = 'psa_candidate';

add_action('init', function () {
    register_post_type(PSA_CANDIDATE_POST_TYPE, [
        'labels' => [
            'name' => 'PSA Story Desk',
            'singular_name' => 'Story Candidate',
            'add_new_item' => 'Add Story Candidate',
            'edit_item' => 'Edit Story Candidate',
            'menu_name' => 'PSA Story Desk',
        ],
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => true,
        'show_in_rest' => true,
        'rest_base' => 'psa-candidates',
        'supports' => ['title', 'editor', 'author'],
        'menu_icon' => 'dashicons-media-document',
    ]);
});

function psa_meta_fields() {
    return [
        '_psa_original_url',
        '_psa_original_reporting_url',
        '_psa_primary_source_url',
        '_psa_source_name',
        '_psa_source_registry_id',
        '_psa_source_type',
        '_psa_source_country',
        '_psa_published_at',
        '_psa_summary',
        '_psa_topics_json',
        '_psa_scores_json',
        '_psa_key_facts_json',
        '_psa_key_facts_text',
        '_psa_why_it_matters',
        '_psa_moses_take',
        '_psa_sarah_take',
        '_psa_additional_sources',
        '_psa_promoted_post_id',
    ];
}

add_action('init', function () {
    foreach (psa_meta_fields() as $key) {
        register_post_meta(PSA_CANDIDATE_POST_TYPE, $key, [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'auth_callback' => function () {
                return current_user_can('edit_posts');
            },
        ]);
    }
});

add_action('rest_api_init', function () {
    register_rest_route('psa/v1', '/candidates', [
        'methods' => 'POST',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
        'callback' => 'psa_receive_candidate',
    ]);
});

function psa_receive_candidate(WP_REST_Request $request) {
    $data = $request->get_json_params();

    $title = sanitize_text_field($data['title'] ?? '');
    $original_url = esc_url_raw($data['original_url'] ?? '');
    $source_name = sanitize_text_field($data['source_name'] ?? '');

    if (!$title || !$original_url || !$source_name) {
        return new WP_Error(
            'psa_invalid_candidate',
            'title, original_url and source_name are required.',
            ['status' => 400]
        );
    }

    $existing = get_posts([
        'post_type' => PSA_CANDIDATE_POST_TYPE,
        'post_status' => 'any',
        'posts_per_page' => 1,
        'fields' => 'ids',
        'meta_key' => '_psa_original_url',
        'meta_value' => $original_url,
    ]);

    if ($existing) {
        return rest_ensure_response([
            'id' => (int) $existing[0],
            'duplicate' => true,
        ]);
    }

    $summary = sanitize_textarea_field($data['summary'] ?? '');

    $post_id = wp_insert_post([
        'post_type' => PSA_CANDIDATE_POST_TYPE,
        'post_status' => 'draft',
        'post_title' => $title,
        'post_content' => $summary,
    ], true);

    if (is_wp_error($post_id)) {
        return $post_id;
    }

    $map = [
        '_psa_original_url' => $original_url,
        '_psa_original_reporting_url' => esc_url_raw($data['original_reporting_url'] ?? $original_url),
        '_psa_primary_source_url' => esc_url_raw($data['primary_source_url'] ?? $original_url),
        '_psa_source_name' => $source_name,
        '_psa_source_registry_id' => sanitize_key($data['source_registry_id'] ?? ''),
        '_psa_source_type' => sanitize_key($data['source_type'] ?? ''),
        '_psa_source_country' => sanitize_text_field($data['source_country'] ?? ''),
        '_psa_published_at' => sanitize_text_field($data['published_at'] ?? ''),
        '_psa_summary' => $summary,
        '_psa_topics_json' => wp_json_encode($data['topics'] ?? []),
        '_psa_scores_json' => wp_json_encode($data['scores'] ?? []),
        '_psa_key_facts_json' => wp_json_encode($data['key_facts'] ?? []),
    ];

    foreach ($map as $key => $value) {
        update_post_meta($post_id, $key, $value);
    }

    return rest_ensure_response([
        'id' => (int) $post_id,
        'duplicate' => false,
    ]);
}

add_action('add_meta_boxes_' . PSA_CANDIDATE_POST_TYPE, function () {
    add_meta_box(
        'psa_provenance',
        'Source & provenance',
        'psa_render_provenance_box',
        PSA_CANDIDATE_POST_TYPE,
        'normal',
        'high'
    );

    add_meta_box(
        'psa_editorial',
        'PSA editorial layer',
        'psa_render_editorial_box',
        PSA_CANDIDATE_POST_TYPE,
        'normal',
        'high'
    );

    add_meta_box(
        'psa_publish',
        'Create PSA article',
        'psa_render_publish_box',
        PSA_CANDIDATE_POST_TYPE,
        'side',
        'high'
    );
});

function psa_link_row($label, $url) {
    if (!$url) {
        return;
    }

    echo '<p><strong>' . esc_html($label) . '</strong><br>';
    echo '<a href="' . esc_url($url) . '" target="_blank" rel="noopener">' . esc_html($url) . '</a></p>';
}

function psa_render_provenance_box($post) {
    $source_name = get_post_meta($post->ID, '_psa_source_name', true);
    $original = get_post_meta($post->ID, '_psa_original_url', true);
    $reporting = get_post_meta($post->ID, '_psa_original_reporting_url', true);
    $primary = get_post_meta($post->ID, '_psa_primary_source_url', true);
    $scores = json_decode(get_post_meta($post->ID, '_psa_scores_json', true), true);

    echo '<p><strong>Source:</strong> ' . esc_html($source_name) . '</p>';
    psa_link_row('Original item', $original);

    if ($reporting && $reporting !== $original) {
        psa_link_row('Original reporting', $reporting);
    }
    if ($primary && $primary !== $original) {
        psa_link_row('Primary source', $primary);
    }

    if (is_array($scores) && $scores) {
        echo '<hr><table style="width:100%;max-width:620px">';
        foreach ($scores as $key => $value) {
            if (is_bool($value) || is_array($value)) {
                continue;
            }
            echo '<tr><td style="padding:3px 12px 3px 0"><strong>' .
                esc_html(ucwords(str_replace('_', ' ', $key))) .
                '</strong></td><td>' . esc_html((string) $value) . '</td></tr>';
        }
        echo '</table>';
    }
}

function psa_textarea($name, $label, $value, $rows = 4, $help = '') {
    echo '<p><label for="' . esc_attr($name) . '"><strong>' . esc_html($label) . '</strong></label></p>';
    if ($help) {
        echo '<p style="margin-top:-6px;color:#666">' . esc_html($help) . '</p>';
    }
    echo '<textarea style="width:100%" rows="' . (int) $rows . '" id="' .
        esc_attr($name) . '" name="' . esc_attr($name) . '">' .
        esc_textarea($value) . '</textarea>';
}

function psa_render_editorial_box($post) {
    wp_nonce_field('psa_save_candidate', 'psa_candidate_nonce');

    $summary = get_post_meta($post->ID, '_psa_summary', true);
    $facts = get_post_meta($post->ID, '_psa_key_facts_text', true);
    $why = get_post_meta($post->ID, '_psa_why_it_matters', true);
    $moses = get_post_meta($post->ID, '_psa_moses_take', true);
    $sarah = get_post_meta($post->ID, '_psa_sarah_take', true);
    $additional = get_post_meta($post->ID, '_psa_additional_sources', true);

    psa_textarea('_psa_summary', 'The short version', $summary, 5, 'Straight factual distillation. No PSA opinion here.');
    psa_textarea('_psa_key_facts_text', 'Key facts', $facts, 6, 'One factual point per line.');
    psa_textarea('_psa_why_it_matters', 'Why it matters', $why, 4, 'Context, significance and useful explanation.');
    psa_textarea('_psa_moses_take', "Moses' take", $moses, 4, 'Optional human voice.');
    psa_textarea('_psa_sarah_take', "Sarah's take", $sarah, 4, 'Optional human voice.');
    psa_textarea('_psa_additional_sources', 'Additional sources', $additional, 4, 'One per line as Label | https://example.com/story');
}

function psa_render_publish_box($post) {
    $original = get_post_meta($post->ID, '_psa_original_url', true);
    $promoted_id = (int) get_post_meta($post->ID, '_psa_promoted_post_id', true);

    if (!$original) {
        echo '<p><strong>Blocked:</strong> an original-source URL is required.</p>';
        return;
    }

    if ($promoted_id && get_post($promoted_id)) {
        echo '<p>This candidate already has a PSA article draft.</p>';
        echo '<p><a class="button button-primary" href="' .
            esc_url(get_edit_post_link($promoted_id)) . '">Edit article draft</a></p>';
        return;
    }

    $url = wp_nonce_url(
        admin_url('admin-post.php?action=psa_promote_candidate&post_id=' . $post->ID),
        'psa_promote_' . $post->ID
    );

    echo '<p>Creates a normal WordPress <strong>draft</strong>. Nothing is published automatically.</p>';
    echo '<p><a class="button button-primary" href="' . esc_url($url) . '">Create publish-ready draft</a></p>';
}

add_action('save_post_' . PSA_CANDIDATE_POST_TYPE, function ($post_id) {
    if (!isset($_POST['psa_candidate_nonce']) ||
        !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['psa_candidate_nonce'])), 'psa_save_candidate')) {
        return;
    }

    if (!current_user_can('edit_post', $post_id) || wp_is_post_revision($post_id)) {
        return;
    }

    $fields = [
        '_psa_summary',
        '_psa_key_facts_text',
        '_psa_why_it_matters',
        '_psa_moses_take',
        '_psa_sarah_take',
        '_psa_additional_sources',
    ];

    foreach ($fields as $field) {
        if (isset($_POST[$field])) {
            update_post_meta(
                $post_id,
                $field,
                sanitize_textarea_field(wp_unslash($_POST[$field]))
            );
        }
    }
});

function psa_paragraphs($text) {
    return wpautop(esc_html($text));
}

function psa_source_link($label, $url) {
    if (!$url) {
        return '';
    }

    return '<li><a href="' . esc_url($url) .
        '" target="_blank" rel="noopener external">' .
        esc_html($label) . '</a></li>';
}

add_action('admin_post_psa_promote_candidate', function () {
    $candidate_id = isset($_GET['post_id']) ? absint($_GET['post_id']) : 0;

    if (!$candidate_id ||
        get_post_type($candidate_id) !== PSA_CANDIDATE_POST_TYPE ||
        !current_user_can('edit_post', $candidate_id)) {
        wp_die('You cannot promote this candidate.');
    }

    check_admin_referer('psa_promote_' . $candidate_id);

    $original = get_post_meta($candidate_id, '_psa_original_url', true);
    $source_name = get_post_meta($candidate_id, '_psa_source_name', true);

    if (!$original || !$source_name) {
        wp_die('PSA requires an original source and source name before an article can be created.');
    }

    $candidate = get_post($candidate_id);
    $summary = get_post_meta($candidate_id, '_psa_summary', true);
    $facts = get_post_meta($candidate_id, '_psa_key_facts_text', true);
    $why = get_post_meta($candidate_id, '_psa_why_it_matters', true);
    $moses = get_post_meta($candidate_id, '_psa_moses_take', true);
    $sarah = get_post_meta($candidate_id, '_psa_sarah_take', true);
    $reporting = get_post_meta($candidate_id, '_psa_original_reporting_url', true);
    $primary = get_post_meta($candidate_id, '_psa_primary_source_url', true);
    $additional = get_post_meta($candidate_id, '_psa_additional_sources', true);

    $content = '<h2>The short version</h2>' . psa_paragraphs($summary);

    $fact_lines = array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $facts)));
    if ($fact_lines) {
        $content .= '<h2>Key facts</h2><ul>';
        foreach ($fact_lines as $fact) {
            $content .= '<li>' . esc_html($fact) . '</li>';
        }
        $content .= '</ul>';
    }

    if ($why) {
        $content .= '<h2>Why it matters</h2>' . psa_paragraphs($why);
    }

    if ($moses || $sarah) {
        $content .= '<h2>The PSA Take</h2>';
        if ($moses) {
            $content .= '<h3>Moses</h3>' . psa_paragraphs($moses);
        }
        if ($sarah) {
            $content .= '<h3>Sarah</h3>' . psa_paragraphs($sarah);
        }
    }

    $source_links = [];
    $source_links[] = psa_source_link($source_name . ' — original source', $original);

    if ($reporting && $reporting !== $original) {
        $source_links[] = psa_source_link('Original reporting', $reporting);
    }

    if ($primary && $primary !== $original && $primary !== $reporting) {
        $source_links[] = psa_source_link('Primary source', $primary);
    }

    foreach (array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $additional))) as $line) {
        $parts = array_map('trim', explode('|', $line, 2));
        if (count($parts) === 2 && filter_var($parts[1], FILTER_VALIDATE_URL)) {
            $source_links[] = psa_source_link($parts[0], $parts[1]);
        }
    }

    $content .= '<h2>Sources</h2><ul>' . implode('', array_filter($source_links)) . '</ul>';

    $article_id = wp_insert_post([
        'post_type' => 'post',
        'post_status' => 'draft',
        'post_title' => $candidate->post_title,
        'post_content' => $content,
        'post_author' => get_current_user_id(),
    ], true);

    if (is_wp_error($article_id)) {
        wp_die(esc_html($article_id->get_error_message()));
    }

    update_post_meta($article_id, '_psa_candidate_id', (string) $candidate_id);
    update_post_meta($article_id, '_psa_original_url', $original);
    update_post_meta($candidate_id, '_psa_promoted_post_id', (string) $article_id);

    wp_safe_redirect(get_edit_post_link($article_id, 'raw'));
    exit;
});
